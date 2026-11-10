import { protectedResourceMetadata } from "@/lib/oauth/verify";
import { ALL_SCOPES } from "@/lib/agent-keys/keys";
import { OAUTH_RESOURCE } from "@/lib/agent-keys/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Protected Resource Metadata (RFC 9728) voor de MCP-resource van DGDH CUT. Publiek, geen auth. */
export async function GET() {
	return Response.json(
		protectedResourceMetadata(OAUTH_RESOURCE, [...ALL_SCOPES]),
		{ headers: { "cache-control": "no-store" } },
	);
}
