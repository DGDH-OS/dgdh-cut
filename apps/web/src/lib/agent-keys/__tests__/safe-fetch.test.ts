import { describe, expect, test } from "bun:test";
import { isPrivateIp, safeFetchBytes, UrlBlockedError } from "../safe-fetch";

const pub = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;
const bodyOf = (n: number) => new Response(new Uint8Array(n));

describe("isPrivateIp", () => {
	test.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "nonsense"])("%s is privaat", (ip) => {
		expect(isPrivateIp(ip)).toBe(true);
	});
	test.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1"])("%s is publiek", (ip) => {
		expect(isPrivateIp(ip)).toBe(false);
	});
});

describe("safeFetchBytes", () => {
	test("blokkeert http, credentials, localhost, IP-literals en hosts die privaat resolven", async () => {
		const f = (async () => bodyOf(1)) as never;
		for (const u of ["http://example.com/a.mp4", "https://user:pw@example.com/a", "https://localhost/a", "https://127.0.0.1/a", "https://169.254.169.254/latest", "https://[::1]/a", "https://metadata.internal/a"])
			await expect(safeFetchBytes(u, { maxBytes: 100, fetchImpl: f, resolve: pub })).rejects.toBeInstanceOf(UrlBlockedError);
		const priv = (async () => [{ address: "10.0.0.5", family: 4 }]) as never;
		await expect(safeFetchBytes("https://intern.example.com/a", { maxBytes: 100, fetchImpl: f, resolve: priv })).rejects.toBeInstanceOf(UrlBlockedError);
	});
	test("blokkeert een redirect naar een intern adres", async () => {
		let calls = 0;
		const f = (async () => {
			calls++;
			return new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } });
		}) as never;
		await expect(safeFetchBytes("https://example.com/a", { maxBytes: 100, fetchImpl: f, resolve: pub })).rejects.toBeInstanceOf(UrlBlockedError);
		expect(calls).toBe(1);
	});
	test("volgt een redirect naar een publiek adres en stopt bij te veel redirects", async () => {
		let n = 0;
		const ok = (async () => (n++ === 0 ? new Response(null, { status: 301, headers: { location: "/b.mp4" } }) : bodyOf(5))) as never;
		const r = await safeFetchBytes("https://example.com/a", { maxBytes: 100, fetchImpl: ok, resolve: pub });
		expect(r.bytes.byteLength).toBe(5);
		expect(r.url).toBe("https://example.com/b.mp4");
		const loop = (async () => new Response(null, { status: 302, headers: { location: "/x" } })) as never;
		await expect(safeFetchBytes("https://example.com/a", { maxBytes: 100, fetchImpl: loop, resolve: pub, maxRedirects: 2 })).rejects.toBeInstanceOf(UrlBlockedError);
	});
	test("stopt tijdens het lezen bij te grote bestanden, ook zonder content-length", async () => {
		const f = (async () => bodyOf(500)) as never;
		await expect(safeFetchBytes("https://example.com/a", { maxBytes: 100, fetchImpl: f, resolve: pub })).rejects.toBeInstanceOf(RangeError);
	});
});
