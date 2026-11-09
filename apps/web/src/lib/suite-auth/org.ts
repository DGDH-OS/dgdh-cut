// Pure keuzelogica voor het actieve bedrijf (contract 1. OPS/SUITE-SSO-ORG-CONTRACT.md par. 2). Geen IO.
// De cookie `suite-organization` is een voorkeur, nooit autorisatie: lidmaatschap + recht beslissen.

export const SUITE_ORG_COOKIE = "suite-organization";
export const CUT_APP_SLUG = "cut";

export type OrgRight = { status: string; expires_at: string | null };
export type SuiteUserOrg = {
	organization_id: string;
	name: string;
	slug: string;
	type: string; // client | dgdh | owned
	role: string;
	rights: OrgRight[]; // suite.entitlements-rijen voor app_slug cut
};

export type OrgChoice =
	| { kind: "ok"; active: SuiteUserOrg; options: SuiteUserOrg[] }
	| { kind: "no-access"; org: SuiteUserOrg | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** dgdh/owned zijn altijd ontgrendeld; client-orgs hebben een actief of lopend recht nodig dat niet verlopen is. */
export function hasRight(org: SuiteUserOrg, now = Date.now()): boolean {
	if (org.type === "dgdh" || org.type === "owned") return true;
	return org.rights.some(
		(r) =>
			(r.status === "active" || r.status === "trialing") &&
			(r.expires_at === null || Date.parse(r.expires_at) > now),
	);
}

export const entitledOrgs = (orgs: SuiteUserOrg[], now?: number) =>
	orgs.filter((o) => hasRight(o, now));

/** Voorkeur uit de cookie als die een bedrijf met recht is; anders het eerste bedrijf met recht; anders geen toegang. */
export function chooseActiveOrg(
	orgs: SuiteUserOrg[],
	preferred: string | null | undefined,
	now?: number,
): OrgChoice {
	const options = entitledOrgs(orgs, now);
	const wanted = isUuid(preferred) ? preferred.toLowerCase() : null;
	const active = (wanted && options.find((o) => o.organization_id.toLowerCase() === wanted)) || options[0];
	if (active) return { kind: "ok", active, options };
	const named = (wanted && orgs.find((o) => o.organization_id.toLowerCase() === wanted)) || orgs[0] || null;
	return { kind: "no-access", org: named };
}
