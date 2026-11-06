import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const KEY_PREFIX = "cut_live_";

export const ALL_SCOPES = ["media:read", "media:write", "render", "transcribe", "voice", "editor"] as const;
export type Scope = (typeof ALL_SCOPES)[number];

export type AgentKeyRecord = {
	id: string;
	org: string; // owner: Suite user id (org id once the Suite has orgs)
	name: string;
	key_prefix: string; // first chars, for display only
	key_hash: string; // sha256 hex of the full key; the key itself is never stored
	scopes: Scope[];
	rate_limit_per_min: number;
	created_at: string;
	revoked_at: string | null;
	last_used_at: string | null;
};

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export function generateKey(): { key: string; prefix: string; hash: string } {
	const key = KEY_PREFIX + randomBytes(32).toString("base64url");
	return { key, prefix: key.slice(0, KEY_PREFIX.length + 6), hash: hashKey(key) };
}

export function safeEqualHex(a: string, b: string): boolean {
	const x = Buffer.from(a, "hex");
	const y = Buffer.from(b, "hex");
	return x.length === y.length && timingSafeEqual(x, y);
}
