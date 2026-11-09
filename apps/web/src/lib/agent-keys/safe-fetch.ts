import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF-bescherming voor tools die een door het model opgegeven URL ophalen (upload_media_from_url).
 * Beleid 4.8: private, loopback en link-local adressen blokkeren, ook na elke redirect; grootte begrenzen tijdens het lezen.
 * Rest-risico: DNS-rebinding tussen controle en connect (alleen te sluiten met een eigen egress-proxy).
 */
export class UrlBlockedError extends Error {}

export function isPrivateIp(ip: string): boolean {
	const v = isIP(ip);
	if (v === 4) {
		const [a, b] = ip.split(".").map(Number) as [number, number];
		return (
			a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
		);
	}
	if (v === 6) {
		const x = ip.toLowerCase();
		const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
		if (mapped?.[1]) return isPrivateIp(mapped[1]);
		return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || /^fe[89ab]/.test(x) || x.startsWith("ff");
	}
	return true; // geen geldig IP: fail closed
}

async function assertPublicHost(url: URL, resolve: typeof lookup = lookup) {
	if (url.protocol !== "https:") throw new UrlBlockedError("only https URLs");
	if (url.username || url.password) throw new UrlBlockedError("URLs with credentials are not allowed");
	const host = url.hostname.replace(/^\[|\]$/g, "");
	if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new UrlBlockedError("host not allowed");
	const addrs = isIP(host) ? [{ address: host }] : await resolve(host, { all: true }).catch(() => []);
	if (addrs.length === 0) throw new UrlBlockedError("host does not resolve");
	if (addrs.some((a) => isPrivateIp(a.address))) throw new UrlBlockedError("host resolves to a private or internal address");
}

export async function safeFetchBytes(
	rawUrl: string,
	opts: { maxBytes: number; maxRedirects?: number; fetchImpl?: typeof fetch; resolve?: typeof lookup },
): Promise<{ bytes: Uint8Array; url: string; contentType: string | null }> {
	const f = opts.fetchImpl ?? fetch;
	let url = new URL(rawUrl);
	for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
		await assertPublicHost(url, opts.resolve);
		const res = await f(url, { redirect: "manual", signal: AbortSignal.timeout(60_000) });
		if (res.status >= 300 && res.status < 400) {
			const loc = res.headers.get("location");
			if (!loc) throw new UrlBlockedError("redirect without location");
			url = new URL(loc, url);
			continue;
		}
		if (!res.ok) throw new Error(`download failed (${res.status})`);
		const declared = Number(res.headers.get("content-length") ?? 0);
		if (declared > opts.maxBytes) throw new RangeError("file too large");
		const chunks: Uint8Array[] = [];
		let total = 0;
		const reader = res.body?.getReader();
		if (!reader) throw new Error("empty body");
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > opts.maxBytes) {
				await reader.cancel();
				throw new RangeError("file too large");
			}
			chunks.push(value);
		}
		const out = new Uint8Array(total);
		let o = 0;
		for (const c of chunks) { out.set(c, o); o += c.byteLength; }
		return { bytes: out, url: url.toString(), contentType: res.headers.get("content-type") };
	}
	throw new UrlBlockedError("too many redirects");
}
