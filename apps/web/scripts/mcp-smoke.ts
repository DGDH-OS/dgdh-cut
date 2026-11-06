// MCP smoke test with the official SDK client. CUT_URL=http://localhost:3199 CUT_KEY=cut_live_… bun scripts/agent/mcp-smoke.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = `${process.env.CUT_URL}/api/mcp`;
const client = new Client({ name: "smoke", version: "1" });
await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { authorization: `Bearer ${process.env.CUT_KEY}` } } }));
const { tools } = await client.listTools();
console.log("TOOLS", tools.map((t) => t.name).join(","));
for (const [name, args] of [["list_media", {}], ["list_catalog", { kind: "luts" }]] as const) {
	const r: any = await client.callTool({ name, arguments: args });
	console.log("CALL", name, "isError=", r.isError ?? false, r.content[0].text.slice(0, 160));
}
await client.close();
