import { authenticate } from "@/lib/agent-keys/auth";
import { getStore } from "@/lib/agent-keys/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usage summary for the caller's org (default last 30 days; ?since=ISO).
export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.ok) return auth.response;
	const since = new URL(request.url).searchParams.get("since") ?? new Date(Date.now() - 30 * 864e5).toISOString();
	const by_tool = await getStore().usageSummary(auth.key.org, since);
	return Response.json({ ok: true, org: auth.key.org, since, total_units: by_tool.reduce((a, b) => a + b.units, 0), by_tool });
}
