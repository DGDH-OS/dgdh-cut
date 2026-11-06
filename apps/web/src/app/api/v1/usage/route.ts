import { authenticate } from "@/lib/agent-keys/auth";
import { budgetState, effective, monthStartIso } from "@/lib/agent-keys/billing";
import { getStore } from "@/lib/agent-keys/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usage summary for the caller's org (default last 30 days; ?since=ISO) + this key's budget state.
// Totals count only billable events: pending renders are shown separately, voided ones are excluded.
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.ok) return auth.response;
	const since = new URL(request.url).searchParams.get("since") ?? new Date(Date.now() - 30 * 864e5).toISOString();
	const store = getStore();
	const eff = effective(await store.listUsage({ org: auth.key.org }, since));
	const by = new Map<string, { tool: string; calls: number; units: number; eur: number }>();
	const by_state: Record<string, { events: number; units: number; eur: number }> = {};
	for (const e of eff) {
		if (e.status !== "ok") continue;
		const s = (by_state[e.eff] ??= { events: 0, units: 0, eur: 0 });
		s.events++; s.units = +(s.units + e.units).toFixed(6); s.eur = +(s.eur + e.eur).toFixed(6);
		if (e.eff === "pending" || e.eff === "voided") continue; // billable = final | accepted | auto_accepted
		const x = by.get(e.tool) ?? { tool: e.tool, calls: 0, units: 0, eur: 0 };
		x.calls++; x.units = +(x.units + e.units).toFixed(6); x.eur = +(x.eur + e.eur).toFixed(6);
		by.set(e.tool, x);
	}
	const by_tool = [...by.values()];
	const budget = budgetState(auth.key, await store.listUsage({ keyId: auth.key.id }, monthStartIso()));
	return Response.json({
		ok: true, org: auth.key.org, since,
		total_units: +by_tool.reduce((a, b) => a + b.units, 0).toFixed(6), total_eur: +by_tool.reduce((a, b) => a + b.eur, 0).toFixed(6),
		by_tool, by_state, budget,
	});
}
