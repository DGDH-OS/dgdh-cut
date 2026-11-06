// Generates docs/openapi.yaml from the tool registry (single source of truth). bun scripts/gen-openapi.ts
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { ALL_SCOPES } from "../src/lib/agent-keys/keys";
import { TOOLS } from "../src/lib/agent-keys/tools";

const err = { description: "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } };
const paths: Record<string, unknown> = {
	"/api/v1/tools": { get: { operationId: "listTools", summary: "Tools this key may call (with JSON Schemas)", security: [{ bearer: [] }], responses: { "200": { description: "OK" }, "401": err, "429": err } } },
	"/api/v1/usage": { get: { operationId: "usage", summary: "Billable units + EUR per tool, per state (pending/accepted/voided) and this key's budget (default last 30 days)", security: [{ bearer: [] }], parameters: [{ name: "since", in: "query", schema: { type: "string", format: "date-time" } }], responses: { "200": { description: "OK" }, "401": err } } },
	"/api/v1/media/{file}": { get: { operationId: "downloadMedia", summary: "Download a media-bin file (renders)", security: [{ bearer: [] }], parameters: [{ name: "file", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Video bytes" }, "401": err, "404": err } } },
	"/api/agent/projects": {
		post: { operationId: "putAgentProject", summary: "Store an agent project (dgdh-cut-agent-project/v1) server-side; owned by the key's org. Bearer key (scope editor) or Suite session.", security: [{ bearer: [] }, { suiteSession: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["schema", "project", "media"], properties: { schema: { const: "dgdh-cut-agent-project/v1" }, project: { type: "object" }, media: { type: "array", items: { type: "object" } } } } } } }, responses: { "200": { description: "{ok,id,revision,import}" }, "400": err, "401": err, "403": err, "413": err } },
		get: { operationId: "getAgentProjects", summary: "List own projects, or one with ?id=", security: [{ bearer: [] }, { suiteSession: [] }], parameters: [{ name: "id", in: "query", schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" }, "401": err, "404": err } },
	},
	"/api/v1/keys": {
		post: { operationId: "createKey", summary: "Create an API key (Suite browser session required). Key is shown once.", security: [{ suiteSession: [] }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, scopes: { type: "array", items: { enum: [...ALL_SCOPES] } }, rate_limit_per_min: { type: "integer", minimum: 1, maximum: 600 }, budget_eur_month: { type: ["number", "null"], description: "hard cap EUR per UTC month" }, budget_units_day: { type: ["number", "null"], description: "hard cap billable units per UTC day" } }, required: ["name"] } } } }, responses: { "201": { description: "Created" }, "401": err } },
		get: { operationId: "listKeys", summary: "List own keys", security: [{ suiteSession: [] }], responses: { "200": { description: "OK" } } },
		delete: { operationId: "revokeKey", summary: "Revoke a key", security: [{ suiteSession: [] }], parameters: [{ name: "id", in: "query", required: true, schema: { type: "string", format: "uuid" } }], responses: { "200": { description: "OK" } } },
	},
};
for (const t of TOOLS) {
	const { $schema: _s, ...schema } = z.toJSONSchema(z.object({ ...t.shape, dry_run: z.boolean().optional().describe("true = price preview only, nothing executed or billed") })) as Record<string, unknown>;
	paths[`/api/v1/tools/${t.name}`] = { post: { operationId: t.name, summary: t.description, description: `Required scope: \`${t.scope}\`. ${t.price ? `Billable (pricing.json units${t.gated ? ", billed only after accept_export / 24 h auto-accept" : ""}); preview with dry_run=true.` : "Free."}`, security: [{ bearer: [] }], "x-scope": t.scope, "x-billable": !!t.price, "x-gated": !!t.gated, requestBody: { required: true, content: { "application/json": { schema } } }, responses: { "200": { description: "Tool result", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, download_url: { type: "string" } }, additionalProperties: true } } } }, "400": err, "401": err, "403": err, "422": err, "402": err, "429": err } } };
}
const doc = {
	openapi: "3.1.0",
	info: { title: "DGDH CUT Agent API", version: "2.0.0", description: "Headless video tools for agents. Same tools are available over MCP at /api/mcp (Streamable HTTP). Auth: `Authorization: Bearer cut_live_…`." },
	servers: [{ url: "https://studio.dgdh-os.com" }],
	paths,
	components: {
		securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "CUT API key" }, suiteSession: { type: "apiKey", in: "cookie", name: "sb-auth-token" } },
		schemas: { Error: { type: "object", properties: { ok: { const: false }, error: { type: "string" } }, required: ["ok", "error"] } },
	},
};
writeFileSync(new URL("../../../docs/openapi.yaml", import.meta.url), Bun.YAML.stringify(doc, null, 2) + "\n");
console.log("paths:", Object.keys(paths).length);
