import { hashKey, KEY_PREFIX, safeEqualHex, type AgentKeyRecord, type Scope } from "./keys";
import { rateLimit } from "./ratelimit";
import { getStore, type UsageEvent } from "./store";
import { toolByName, ToolError, type ToolCtx } from "./tools";

export type AuthResult =
	| { ok: true; key: AgentKeyRecord }
	| { ok: false; response: Response };

const deny = (status: number, error: string, extra: Record<string, string> = {}) =>
	({ ok: false as const, response: Response.json({ ok: false, error }, { status, headers: { "www-authenticate": 'Bearer realm="dgdh-cut"', ...extra } }) });

/** Bearer API-key check: hash lookup, revoked, rate limit. Fail closed. */
export async function authenticate(request: Request): Promise<AuthResult> {
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

/** Run one tool for an authenticated key: scope check, execution, usage event (always, incl. errors). */
export async function runTool(
	key: AgentKeyRecord, name: string, args: unknown, ctx: ToolCtx, channel: UsageEvent["channel"],
): Promise<{ status: number; body: any }> {
	const tool = toolByName(name);
	if (!tool) return { status: 404, body: { ok: false, error: `unknown tool ${name}` } };
	if (!hasScope(key, tool.scope)) return { status: 403, body: { ok: false, error: `missing scope ${tool.scope}` } };
	const { z } = await import("zod");
	const parsed = z.object(tool.shape).safeParse(args ?? {});
	if (!parsed.success) return { status: 400, body: { ok: false, error: "invalid arguments", issues: parsed.error.issues } };
	const t0 = Date.now();
	let status: "ok" | "error" = "ok";
	let out: { status: number; body: any };
	try {
		out = { status: 200, body: { ok: true, ...(await tool.run(parsed.data, ctx) as object) } };
	} catch (e) {
		status = "error";
		out = { status: e instanceof ToolError ? 422 : 500, body: { ok: false, error: e instanceof ToolError ? e.message : "internal error" } };
	}
	try {
		await getStore().appendUsage({ key_id: key.id, org: key.org, tool: name, units: status === "ok" ? tool.units : 0, ts: new Date().toISOString(), status, ms: Date.now() - t0, channel });
	} catch (e) { console.error("usage event failed", e); }
	return out;
}
