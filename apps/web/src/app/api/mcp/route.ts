import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticate, hasScope, originOf, runTool } from "@/lib/agent-keys/auth";
import { TOOLS } from "@/lib/agent-keys/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MCP Streamable HTTP endpoint (stateless, JSON responses). Auth = Bearer API key (see proxy.ts).
async function handle(request: Request): Promise<Response> {
	const auth = await authenticate(request);
	if (!auth.ok) return auth.response;
	const key = auth.key;
	const ctx = { origin: originOf(request) };

	const server = new McpServer({ name: "dgdh-cut", version: "1.0.0" });
	for (const tool of TOOLS) {
		if (!hasScope(key, tool.scope)) continue; // only advertise what this key may call
		server.registerTool(tool.name, { description: tool.description, inputSchema: tool.shape }, async (args) => {
			const { body } = await runTool(key, tool.name, args, ctx, "mcp");
			return { content: [{ type: "text" as const, text: JSON.stringify(body) }], isError: body.ok === false };
		});
	}
	const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
	await server.connect(transport);
	return transport.handleRequest(request);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
