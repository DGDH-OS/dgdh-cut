import { authenticate, originOf, runTool } from "@/lib/agent-keys/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ tool: string }> }) {
	const auth = await authenticate(request);
	if (!auth.ok) return auth.response;
	const { tool } = await params;
	const args = await request.json().catch(() => ({}));
	const { status, body, headers } = await runTool(auth.key, tool, args, { origin: originOf(request) }, "rest");
	return Response.json(body, { status, headers });
}
