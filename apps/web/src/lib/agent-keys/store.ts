import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AgentKeyRecord, Scope } from "./keys";

/** Append-only metering event: one per agent call. The pricing stream bills pay-as-you-go from this. */
export type UsageEvent = {
	id: string; // event id (uuid). Render events are referenced by resolution events (accept_export).
	key_id: string;
	org: string;
	tool: string;
	units: number; // billable quantity in pricing.json units (rounded up to 0.1), see pricing.ts
	eur: number; // units x PAYG rate at call time (CONCEPT prices)
	unit?: string | null; // e.g. export_min; null for free tools
	state?: "final" | "pending" | "accepted" | "voided"; // pending = render awaiting accept_export; absent on legacy rows = final
	ref?: string | null; // resolution events point at the render event they accept/void
	ts: string; // ISO
	status: "ok" | "error";
	ms: number;
	channel: "mcp" | "rest";
};
export type UsageScope = { keyId?: string; org?: string };

export interface AgentKeyStore {
	create(input: { org: string; name: string; scopes: Scope[]; rate_limit_per_min: number; key_prefix: string; key_hash: string; budget_eur_month?: number | null; budget_units_day?: number | null }): Promise<AgentKeyRecord>;
	findByHash(hash: string): Promise<AgentKeyRecord | null>;
	listByOrg(org: string): Promise<AgentKeyRecord[]>;
	revoke(org: string, id: string): Promise<boolean>;
	touch(id: string): Promise<void>;
	appendUsage(event: UsageEvent): Promise<void>;
	usageSummary(org: string, sinceIso: string): Promise<{ tool: string; calls: number; units: number }[]>;
	/** Raw append-only events (oldest first) for a key or org since a timestamp. */
	listUsage(scope: UsageScope, sinceIso: string): Promise<UsageEvent[]>;
	getUsage(id: string): Promise<UsageEvent | null>;
}

// ---- Supabase (production): PostgREST with the service-role key, server-side only. Schema: schema.sql
class SupabaseStore implements AgentKeyStore {
	constructor(private url: string, private key: string) {}
	private async rest(path: string, init: RequestInit & { prefer?: string } = {}) {
		const res = await fetch(`${this.url}/rest/v1/${path}`, {
			...init,
			headers: {
				apikey: this.key,
				authorization: `Bearer ${this.key}`,
				"content-type": "application/json",
				prefer: init.prefer ?? "return=representation",
			},
		});
		if (!res.ok) throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
		const text = await res.text();
		return text ? JSON.parse(text) : null;
	}
	async create(i: Parameters<AgentKeyStore["create"]>[0]) {
		const rows = await this.rest("agent_api_keys", { method: "POST", body: JSON.stringify({ ...i, app: "cut" }) });
		return rows[0] as AgentKeyRecord;
	}
	async findByHash(hash: string) {
		const rows = await this.rest(`agent_api_keys?key_hash=eq.${hash}&app=eq.cut&select=*`);
		return (rows[0] as AgentKeyRecord) ?? null;
	}
	async listByOrg(org: string) {
		return (await this.rest(`agent_api_keys?org=eq.${encodeURIComponent(org)}&app=eq.cut&select=*&order=created_at.desc`)) as AgentKeyRecord[];
	}
	async revoke(org: string, id: string) {
		const rows = await this.rest(`agent_api_keys?id=eq.${id}&org=eq.${encodeURIComponent(org)}&revoked_at=is.null`, {
			method: "PATCH",
			body: JSON.stringify({ revoked_at: new Date().toISOString() }),
		});
		return rows.length > 0;
	}
	async touch(id: string) {
		await this.rest(`agent_api_keys?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ last_used_at: new Date().toISOString() }), prefer: "return=minimal" });
	}
	async appendUsage(e: UsageEvent) {
		const { id, ...rest } = e; // columns added by schema-v2-budget-accept.sql (event_id, eur, unit, state, ref)
		await this.rest("agent_usage_events", { method: "POST", body: JSON.stringify({ ...rest, event_id: id, app: "cut" }), prefer: "return=minimal" });
	}
	private fromRow(r: any): UsageEvent { const { event_id, app: _a, ...rest } = r; return { ...rest, id: event_id ?? String(r.id), eur: Number(r.eur ?? 0), units: Number(r.units ?? 0) }; }
	async listUsage(scope: UsageScope, since: string) {
		const f = scope.keyId ? `key_id=eq.${encodeURIComponent(scope.keyId)}` : `org=eq.${encodeURIComponent(scope.org ?? "")}`;
		const rows = (await this.rest(`agent_usage_events?${f}&app=eq.cut&ts=gte.${encodeURIComponent(since)}&select=*&order=ts.asc&limit=10000`)) as any[];
		return rows.map((r) => this.fromRow(r));
	}
	async getUsage(id: string) {
		const rows = (await this.rest(`agent_usage_events?event_id=eq.${encodeURIComponent(id)}&app=eq.cut&select=*`)) as any[];
		return rows[0] ? this.fromRow(rows[0]) : null;
	}
	async usageSummary(org: string, since: string) {
		const rows = (await this.rest(`agent_usage_events?org=eq.${encodeURIComponent(org)}&app=eq.cut&ts=gte.${since}&select=tool,units`)) as { tool: string; units: number }[];
		return summarize(rows);
	}
}

function summarize(rows: { tool: string; units: number }[]) {
	const m = new Map<string, { tool: string; calls: number; units: number }>();
	for (const r of rows) {
		const x = m.get(r.tool) ?? { tool: r.tool, calls: 0, units: 0 };
		x.calls++;
		x.units += r.units;
		m.set(r.tool, x);
	}
	return [...m.values()];
}

// ---- File store (dev/local + single-node fallback): keys.json + usage.jsonl (append-only)
class FileStore implements AgentKeyStore {
	constructor(private dir: string) {}
	private get keysPath() { return join(this.dir, "keys.json"); }
	private get usagePath() { return join(this.dir, "usage.jsonl"); }
	private async read(): Promise<AgentKeyRecord[]> {
		try { return JSON.parse(await readFile(this.keysPath, "utf8")); } catch { return []; }
	}
	private async write(rows: AgentKeyRecord[]) {
		await mkdir(this.dir, { recursive: true });
		await writeFile(this.keysPath, JSON.stringify(rows, null, 1), { mode: 0o600 });
	}
	async create(i: Parameters<AgentKeyStore["create"]>[0]) {
		const rec: AgentKeyRecord = { id: randomUUID(), ...i, created_at: new Date().toISOString(), revoked_at: null, last_used_at: null };
		await this.write([...(await this.read()), rec]);
		return rec;
	}
	async findByHash(hash: string) { return (await this.read()).find((r) => r.key_hash === hash) ?? null; }
	async listByOrg(org: string) { return (await this.read()).filter((r) => r.org === org); }
	async revoke(org: string, id: string) {
		const rows = await this.read();
		const r = rows.find((x) => x.id === id && x.org === org && !x.revoked_at);
		if (!r) return false;
		r.revoked_at = new Date().toISOString();
		await this.write(rows);
		return true;
	}
	async touch(id: string) {
		const rows = await this.read();
		const r = rows.find((x) => x.id === id);
		if (r) { r.last_used_at = new Date().toISOString(); await this.write(rows); }
	}
	async appendUsage(e: UsageEvent) {
		await mkdir(this.dir, { recursive: true });
		await appendFile(this.usagePath, JSON.stringify(e) + "\n");
	}
	private async allUsage(): Promise<UsageEvent[]> {
		let text = "";
		try { text = await readFile(this.usagePath, "utf8"); } catch {}
		return text.split("\n").filter(Boolean).map((l) => { const e = JSON.parse(l) as UsageEvent; return { ...e, id: e.id ?? `legacy-${e.ts}-${e.key_id}`, eur: e.eur ?? 0 }; });
	}
	async listUsage(scope: UsageScope, since: string) {
		return (await this.allUsage()).filter((e) => e.ts >= since && (scope.keyId ? e.key_id === scope.keyId : e.org === scope.org));
	}
	async getUsage(id: string) { return (await this.allUsage()).find((e) => e.id === id) ?? null; }
	async usageSummary(org: string, since: string) {
		let text = "";
		try { text = await readFile(this.usagePath, "utf8"); } catch {}
		const rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as UsageEvent).filter((e) => e.org === org && e.ts >= since);
		return summarize(rows);
	}
}

let store: AgentKeyStore | null = null;
export function getStore(): AgentKeyStore {
	if (store) return store;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const sr = process.env.CUT_SUPABASE_SERVICE_ROLE_KEY;
	store = url && sr ? new SupabaseStore(url, sr) : new FileStore(process.env.CUT_AGENT_KEYS_DIR || join(process.cwd(), ".agent-keys"));
	return store;
}
