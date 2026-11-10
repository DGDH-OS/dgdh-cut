import { z } from "zod";
import { TOOLS } from "@/lib/agent-keys/tools";
import { OAUTH_RESOURCE } from "@/lib/agent-keys/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** OpenAPI 3.0.3 voor het REST-oppervlak van DGDH CUT, gegenereerd uit de tool-registry. Publiek. */
export async function GET() {
	const paths: Record<string, unknown> = {};
	for (const t of TOOLS) {
		paths[`/api/v1/tools/${t.name}`] = {
			post: {
				operationId: t.name,
				summary: t.description,
				requestBody: {
					required: true,
					content: {
						"application/json": { schema: z.toJSONSchema(z.object({ ...t.shape, dry_run: z.boolean().optional() })) },
					},
				},
				responses: {
					"200": { description: "OK" },
					"400": { description: "ongeldige argumenten" },
					"401": { description: "niet geauthenticeerd (Bearer key of OAuth-token ontbreekt)" },
					"403": { description: "scope ontbreekt" },
				},
			},
		};
	}
	const base = OAUTH_RESOURCE.replace(/\/api\/mcp$/, "");
	return Response.json({
		openapi: "3.0.3",
		info: { title: "DGDH CUT", version: "2.0.0" },
		servers: [{ url: base }],
		security: [{ bearerAuth: [] }],
		paths,
		components: {
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API-sleutel of OAuth-token" },
			},
		},
	});
}
