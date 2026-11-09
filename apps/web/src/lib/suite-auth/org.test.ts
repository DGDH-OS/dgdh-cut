import { describe, expect, test } from "bun:test";
import { chooseActiveOrg, hasRight, type SuiteUserOrg } from "./org";

const o = (id: string, type: string, rights: SuiteUserOrg["rights"] = []): SuiteUserOrg => ({
	organization_id: id, name: id, slug: id, type, role: "owner", rights,
});
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = Date.parse("2026-11-09T12:00:00Z");
const active = { status: "active", expires_at: null };

describe("hasRight", () => {
	test("dgdh en owned altijd", () => {
		expect(hasRight(o(A, "dgdh"), now)).toBe(true);
		expect(hasRight(o(A, "owned"), now)).toBe(true);
	});
	test("client: actief of trialing, niet verlopen", () => {
		expect(hasRight(o(A, "client", [active]), now)).toBe(true);
		expect(hasRight(o(A, "client", [{ status: "trialing", expires_at: "2027-01-01T00:00:00Z" }]), now)).toBe(true);
		expect(hasRight(o(A, "client", [{ status: "active", expires_at: "2026-01-01T00:00:00Z" }]), now)).toBe(false);
		expect(hasRight(o(A, "client", [{ status: "canceled", expires_at: null }]), now)).toBe(false);
		expect(hasRight(o(A, "client"), now)).toBe(false);
	});
});

describe("chooseActiveOrg", () => {
	const orgs = [o(A, "client", [active]), o(B, "client"), o(C, "owned")];
	test("cookie met recht wint", () => {
		const r = chooseActiveOrg(orgs, C, now);
		expect(r.kind === "ok" && r.active.organization_id).toBe(C);
		expect(r.kind === "ok" && r.options.map((x) => x.organization_id)).toEqual([A, C]);
	});
	test("cookie zonder recht valt terug op eerste met recht", () => {
		const r = chooseActiveOrg(orgs, B, now);
		expect(r.kind === "ok" && r.active.organization_id).toBe(A);
	});
	test("ongeldige of ontbrekende cookie", () => {
		expect(chooseActiveOrg(orgs, "x", now).kind).toBe("ok");
		expect(chooseActiveOrg(orgs, undefined, now).kind).toBe("ok");
	});
	test("fabrikeer-cookie voor een org waar je geen lid van bent geeft geen toegang", () => {
		const r = chooseActiveOrg([o(B, "client")], A, now);
		expect(r.kind).toBe("no-access");
	});
	test("geen recht: no-access met genoemd bedrijf", () => {
		const r = chooseActiveOrg([o(B, "client")], B, now);
		expect(r.kind === "no-access" && r.org?.organization_id).toBe(B);
	});
	test("geen lid van iets", () => {
		const r = chooseActiveOrg([], null, now);
		expect(r.kind === "no-access" && r.org).toBe(null);
	});
});
