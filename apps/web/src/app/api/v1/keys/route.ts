import { NextRequest } from "next/server";
import { z } from "zod";
import { devAuthEnabled } from "@/lib/suite-auth/config";
import { activeWorkspaceOrg, orgContextFromRequest } from "@/lib/suite-auth/context";
import { ALL_SCOPES, generateKey } from "@/lib/agent-keys/keys";
import { getStore } from "@/lib/agent-keys/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Key management is for signed-in Suite users (browser session), NOT for API keys.
async function owner(request: NextRequest): Promise<string | null> {
	if (devAuthEnabled()) return "dev-user";
	const ctx = await orgContextFromRequest(request).catch(() => null);
	const org = await activeWorkspaceOrg(ctx).catch(() => null);
	return org?.organization_id ?? null; // tenant = Suite-organisatie (niet meer de gebruiker)
}
const unauth = () => Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
const pub = ({ key_hash: _h, ...r }: Record<string, unknown>) => r;

const Create = z.object({
	name: z.string().min(1).max(80),
	scopes: z.array(z.enum(ALL_SCOPES)).min(1).default([...ALL_SCOPES]),
	rate_limit_per_min: z.number().int().min(1).max(600).default(60),
	budget_eur_month: z.number().positive().max(100000).nullable().default(null),
	budget_units_day: z.number().positive().max(1e7).nullable().default(null),
});

export async function POST(request: NextRequest) {
	const org = await owner(request);
	if (!org) return unauth();
	const p = Create.safeParse(await request.json().catch(() => ({})));
	if (!p.success) return Response.json({ ok: false, error: "invalid body", issues: p.error.issues }, { status: 400 });
	const { key, prefix, hash } = generateKey();
	const rec = await getStore().create({ org, ...p.data, key_prefix: prefix, key_hash: hash });
	// Plaintext key is returned exactly once.
	return Response.json({ ok: true, key, record: pub(rec) }, { status: 201 });
}

export async function GET(request: NextRequest) {
	const org = await owner(request);
	if (!org) return unauth();
	return Response.json({ ok: true, keys: (await getStore().listByOrg(org)).map((r) => pub(r)) });
}

export async function DELETE(request: NextRequest) {
	const org = await owner(request);
	if (!org) return unauth();
	const id = request.nextUrl.searchParams.get("id") ?? "";
	return Response.json({ ok: await getStore().revoke(org, id) });
}
