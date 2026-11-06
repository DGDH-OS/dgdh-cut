import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AgentKeyRecord, Scope } from "./keys";

/** Append-only metering event: one per agent call. The pricing stream bills pay-as-you-go from this. */
export type UsageEvent = {
	key_id: string;
	org: string;
	tool: string;
	units: number;
	ts: string; // ISO
	status: "ok" | "error";
	ms: number;
	channel: "mcp" | "rest";
};

export interface AgentKeyStore {
	create(input: { org: string; name: string; scopes: Scope[]; rate_limit_per_min: number; key_prefix: string; key_hash: string }): Promise<AgentKeyRecord>;
	findByHash(hash: string): Promise<AgentKeyRecord | null>;
	listByOrg(org: string): Promise<AgentKeyRecord[]>;
	revoke(org: string, id: string): Promise<boolean>;
	touch(id: string): Promise<void>;
	appendUsage(event: UsageEvent): Promise<void>;
	usageSummary(org: string, sinceIso: string): Promise<{ tool: string; calls: number; units: number }[]>;
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
		await this.rest("agent_usage_events", { method: "POST", body: JSON.stringify({ ...e, app: "cut" }), prefer: "return=minimal" });
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
