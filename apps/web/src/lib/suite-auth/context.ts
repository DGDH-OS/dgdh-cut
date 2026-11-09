import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getSuiteSession } from "./session";
import {
	CUT_APP_SLUG,
	SUITE_ORG_COOKIE,
	chooseActiveOrg,
	type OrgChoice,
	type SuiteUserOrg,
} from "./org";
import { ensureWorkspace } from "./workspace";

export type OrgContext = { userId: string; email: string | null; choice: OrgChoice };

type Row = {
	organization_id: string;
	role: string;
	organizations: { name: string; slug: string; type: string } | { name: string; slug: string; type: string }[] | null;
};

// Korte cache per gebruiker: het lidmaatschap verandert zelden, de proxy draait op elke navigatie.
const TTL_MS = 15_000;
const cache = new Map<string, { at: number; orgs: SuiteUserOrg[] }>();

/** Lidmaatschap + rechten met de gebruikers-JWT (RLS, schema suite). Gooit bij storing: fail closed. */
export async function loadUserOrgs(client: SupabaseClient, userId: string): Promise<SuiteUserOrg[]> {
	const hit = cache.get(userId);
	if (hit && Date.now() - hit.at < TTL_MS) return hit.orgs;
	const suite = client.schema("suite");
	const m = await suite
		.from("organization_members")
		.select("organization_id, role, organizations!inner(name, slug, type)")
		.eq("user_id", userId);
	if (m.error) throw new Error(`lidmaatschap: ${m.error.message}`);
	const rows = (m.data ?? []) as unknown as Row[];
	const ids = rows.map((r) => r.organization_id);
	let rights: { organization_id: string; status: string; expires_at: string | null }[] = [];
	if (ids.length) {
		const e = await suite
			.from("entitlements")
			.select("organization_id, status, expires_at")
			.eq("app_slug", CUT_APP_SLUG)
			.in("status", ["active", "trialing"])
			.in("organization_id", ids);
		if (e.error) throw new Error(`rechten: ${e.error.message}`);
		rights = e.data ?? [];
	}
	const orgs: SuiteUserOrg[] = rows.flatMap((r) => {
		const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
		if (!o) return [];
		return [{
			organization_id: r.organization_id,
			name: o.name,
			slug: o.slug,
			type: o.type,
			role: r.role,
			rights: rights.filter((x) => x.organization_id === r.organization_id),
		}];
	});
	cache.set(userId, { at: Date.now(), orgs });
	return orgs;
}

export async function contextFor(client: SupabaseClient, userId: string, email: string | null, preferred: string | undefined): Promise<OrgContext> {
	const orgs = await loadUserOrgs(client, userId);
	return { userId, email, choice: chooseActiveOrg(orgs, preferred) };
}

/** Voor route handlers en de proxy. null = geen geldige Suite-sessie; gooit bij een storing in de controle. */
export async function orgContextFromRequest(request: NextRequest): Promise<OrgContext | null> {
	const s = await getSuiteSession(request, () => {});
	if (!s) return null;
	return contextFor(s.client, s.userId, s.email, request.cookies.get(SUITE_ORG_COOKIE)?.value);
}

/** Voor server components (layouts/pagina's). Alleen lezen: de proxy ververst de sessiecookies. */
export async function orgContextFromCookies(): Promise<OrgContext | null> {
	const jar = await cookies(); // eerst: markeert de render als dynamisch (nooit statisch prerenderen zonder sessie)
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) return null;
	const client = createServerClient(url, key, { cookies: { getAll: () => jar.getAll(), setAll() {} } });
	const { data, error } = await client.auth.getUser();
	if (error || !data.user || data.user.is_anonymous) return null;
	const aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
	if (aal.data?.currentLevel !== "aal2") return null;
	return contextFor(client, data.user.id, data.user.email ?? null, jar.get(SUITE_ORG_COOKIE)?.value);
}

/** Actief bedrijf + idempotente auto-onboarding van de tenant (workspace). null = geen recht. */
export async function activeWorkspaceOrg(ctx: OrgContext | null) {
	if (!ctx || ctx.choice.kind !== "ok") return null;
	const { active } = ctx.choice;
	await ensureWorkspace({ organization_id: active.organization_id, name: active.name, slug: active.slug, created_by: ctx.userId });
	return active;
}
