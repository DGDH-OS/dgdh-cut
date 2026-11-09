import "server-only";

// Tenant per Suite-organisatie (contract par. 2): public.cut_workspaces, sleutel organization_id.
// Service-role (server-side). Idempotent: ON CONFLICT DO NOTHING, bestaande rij blijft ongemoeid.
const ensured = new Set<string>();

export type WorkspaceInput = { organization_id: string; name: string; slug: string; created_by: string };

export async function ensureWorkspace(w: WorkspaceInput): Promise<void> {
	if (ensured.has(w.organization_id)) return;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const sr = process.env.CUT_SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !sr) return; // dev/file-store: geen tenant-tabel
	const res = await fetch(`${url}/rest/v1/cut_workspaces?on_conflict=organization_id`, {
		method: "POST",
		headers: {
			apikey: sr,
			authorization: `Bearer ${sr}`,
			"content-type": "application/json",
			prefer: "resolution=ignore-duplicates,return=minimal",
		},
		body: JSON.stringify({ organization_id: w.organization_id, name: w.name, slug: w.slug, created_by: w.created_by }),
	});
	if (!res.ok) throw new Error(`workspace aanmaken mislukt (${res.status})`);
	ensured.add(w.organization_id);
}
