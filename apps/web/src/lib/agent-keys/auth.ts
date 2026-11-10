import { hashKey, KEY_PREFIX, safeEqualHex, ALL_SCOPES, type AgentKeyRecord, type Scope } from "./keys";
import { rateLimit } from "./ratelimit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { budgetState, checkBudget, monthStartIso, AUTO_ACCEPT_MS } from "./billing";
import { getStore, type UsageEvent } from "./store";
import { computePrice, priceHelpers, toolByName, ToolError, type ToolCtx } from "./tools";
import { devAuthEnabled } from "@/lib/suite-auth/config";
import { verifyBearer, prmUrl } from "@/lib/oauth/verify";

/** Canonieke MCP-URL van deze app (= OAuth audience / resource). */
export const OAUTH_RESOURCE = "https://studio.dgdh-os.com/api/mcp";
/** App-slug in de Suite-catalogus. */
export const OAUTH_APP = "cut";

export type AuthResult =
	| { ok: true; key: AgentKeyRecord }
	| { ok: false; response: Response };

const deny = (status: number, error: string, extra: Record<string, string> = {}) =>
	({ ok: false as const, response: Response.json({ ok: false, error }, { status, headers: { "www-authenticate": `Bearer realm="dgdh-cut", resource_metadata="${prmUrl(OAUTH_RESOURCE)}"`, "cache-control": "no-store", ...extra } }) });

/** Bearer API-key check: hash lookup, revoked, rate limit. Fail closed. */
export async function authenticate(request: Request): Promise<AuthResult> {
	// 1. OAuth-token (JWT) van de Suite. Alleen JWT's worden hier afgehandeld; API-keys vallen terug.
	const oauth = await verifyBearer(request, { resource: OAUTH_RESOURCE, app: OAUTH_APP });
	if (oauth.kind === "oauth") {
		if (oauth.ok) {
			const id = oauth.identity;
			const key: AgentKeyRecord = {
				id: `oauth:${id.grantId}`,
				org: id.org,
				name: `oauth:${id.clientId}`,
				key_prefix: "oauth",
				key_hash: "",
				scopes: id.scopes.filter((s): s is Scope => (ALL_SCOPES as readonly string[]).includes(s)),
				rate_limit_per_min: 60,
				created_at: new Date(0).toISOString(),
				revoked_at: null,
				last_used_at: null,
				oauth: true,
			};
			return { ok: true, key };
		}
		return { ok: false, response: oauth.response };
	}

	// 2. Bearer-API-key.
	const h = request.headers.get("authorization") ?? "";
	const m = /^Bearer\s+(\S+)$/i.exec(h);
	if (!m || !m[1].startsWith(KEY_PREFIX)) return deny(401, "missing or invalid API key");
	let rec: AgentKeyRecord | null = null;
	try { rec = await getStore().findByHash(hashKey(m[1])); } catch { return deny(503, "key store unavailable"); }
	if (!rec || !safeEqualHex(rec.key_hash, hashKey(m[1])) || rec.revoked_at) return deny(401, "missing or invalid API key");
	const rl = rateLimit(rec.id, rec.rate_limit_per_min);
	if (!rl.ok) return deny(429, "rate limit exceeded", { "retry-after": String(rl.retryAfterSec) });
	void getStore().touch(rec.id).catch(() => {});
	return { ok: true, key: rec };
}

export const hasScope = (k: AgentKeyRecord, s: Scope) => k.scopes.includes(s);

export function originOf(request: Request): string {
	const base = process.env.CUT_APP_URL?.replace(/\/$/, "");
	return base || new URL(request.url).origin;
}

/** Bearer key (scope `editor`) OR Suite browser session. Used by /api/agent/*; fails closed. */
export async function authenticateAgentAccess(request: Request, scope: Scope): Promise<
	| { ok: true; org: string; via: "key" | "session" }
	| { ok: false; response: Response }
> {
	if (request.headers.get("authorization")) {
		const a = await authenticate(request);
		if (!a.ok) return a;
		if (!hasScope(a.key, scope)) return deny(403, `missing scope ${scope}`);
		return { ok: true, org: a.key.org, via: "key" };
	}
	if (devAuthEnabled()) return { ok: true, org: "dev-user", via: "session" };
	const { orgContextFromRequest, activeWorkspaceOrg } = await import("@/lib/suite-auth/context");
	const ctx = await orgContextFromRequest(request as never).catch(() => null);
	if (!ctx) return deny(401, "missing or invalid API key or session");
	const org = await activeWorkspaceOrg(ctx).catch(() => null);
	if (!org) return deny(403, "no access to CUT for this company");
	return { ok: true, org: org.organization_id, via: "session" };
}

/** Run one tool for an authenticated key: scope, validation, price estimate, budget gate, execution, usage event. */
export async function runTool(
	key: AgentKeyRecord, name: string, rawArgs: unknown, ctx: Pick<ToolCtx, "origin">, channel: UsageEvent["channel"],
): Promise<{ status: number; body: any; headers?: Record<string, string> }> {
	const raw = (rawArgs && typeof rawArgs === "object" ? { ...(rawArgs as Record<string, unknown>) } : {}) as Record<string, unknown>;
	let dryRun = raw.dry_run === true || raw.dry_run === "true";
	delete raw.dry_run;
	let args: unknown = raw;
	if (name === "estimate") { // sugar for dry_run on another tool
		const e = z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()).optional() }).safeParse(raw);
		if (!e.success) return { status: 400, body: { ok: false, error: "invalid arguments", issues: e.error.issues } };
		name = e.data.tool; args = e.data.args ?? {}; dryRun = true;
		if (name === "estimate") return { status: 400, body: { ok: false, error: "cannot estimate estimate" } };
	}
	const tool = toolByName(name);
	if (!tool) return { status: 404, body: { ok: false, error: `unknown tool ${name}` } };
	if (!hasScope(key, tool.scope)) return { status: 403, body: { ok: false, error: `missing scope ${tool.scope}` } };
	const parsed = z.object(tool.shape).safeParse(args ?? {});
	if (!parsed.success) return { status: 400, body: { ok: false, error: "invalid arguments", issues: parsed.error.issues } };

	const price = await computePrice(tool, parsed.data, priceHelpers());
	const hasBudget = key.budget_eur_month != null || key.budget_units_day != null;
	let budget: ReturnType<typeof budgetState> | null = null;
	if (hasBudget || dryRun) {
		try {
			budget = budgetState(key, await getStore().listUsage({ keyId: key.id }, monthStartIso()));
		} catch (e) {
			console.error("budget lookup failed", e);
			if (hasBudget) return { status: 503, body: { ok: false, error: "budget check unavailable, refusing to run (fail closed)" } };
		}
	}
	const verdict = budget ? checkBudget(budget, price) : ({ ok: true } as const);
	if (dryRun) {
		return { status: 200, body: { ok: true, dry_run: true, tool: name, executed: false, estimate: price, billing: price.gated ? `billed only after accept_export (auto-accepted after ${AUTO_ACCEPT_MS / 3600e3} h)` : price.eur > 0 ? "billed on completion" : "free", budget, would_be_allowed: verdict.ok, ...(verdict.ok ? {} : { blocked_by: (verdict.body as any).error }) } };
	}
	if (!verdict.ok) return { status: verdict.status, body: verdict.body, headers: verdict.headers };

	const t0 = Date.now();
	let status: "ok" | "error" = "ok";
	let out: { status: number; body: any };
	const eventId = randomUUID();
	try {
		out = { status: 200, body: { ok: true, ...(await tool.run(parsed.data, { ...ctx, key, channel }) as object) } };
	} catch (e) {
		status = "error";
		out = { status: e instanceof ToolError ? 422 : 500, body: { ok: false, error: e instanceof ToolError ? e.message : "internal error" } };
	}
	if (!tool.selfMetered) {
		const billed = status === "ok" ? price : null;
		const ev: UsageEvent = {
			id: eventId, key_id: key.id, org: key.org, tool: name, units: billed?.units ?? 0, eur: billed?.eur ?? 0,
			unit: billed?.lines.map((l) => l.unit).join("+") || null, state: billed?.gated ? "pending" : "final",
			ts: new Date().toISOString(), status, ms: Date.now() - t0, channel,
		};
		try {
			await getStore().appendUsage(ev);
			if (status === "ok") out.body.usage = {
				event_id: ev.id, units: ev.units, eur: ev.eur, state: ev.state,
				...(billed?.gated ? { settle: "call accept_export {usage_event_id, accepted} within 24 h; unresolved renders auto-accept", auto_accept_at: new Date(Date.now() + AUTO_ACCEPT_MS).toISOString() } : {}),
			};
		} catch (e) { console.error("usage event failed", e); }
	}
	return out;
}
