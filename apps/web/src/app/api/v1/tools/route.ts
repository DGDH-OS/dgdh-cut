import { z } from "zod";
import { authenticate, hasScope } from "@/lib/agent-keys/auth";
import { TOOLS } from "@/lib/agent-keys/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const auth = await authenticate(request);
	if (!auth.ok) return auth.response;
	return Response.json({
		ok: true,
		tools: TOOLS.filter((t) => hasScope(auth.key, t.scope)).map((t) => ({
			name: t.name, description: t.description, scope: t.scope, units: t.units,
			input_schema: z.toJSONSchema(z.object(t.shape)),
		})),
	});
}
