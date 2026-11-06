# DGDH CUT via MCP & REST

CUT is bestuurbaar door elke agent. Endpoint (Streamable HTTP, stateless):

```
https://studio.dgdh-os.com/api/mcp        Authorization: Bearer <CUT_API_KEY>
```

Een key maak je aan in de Suite (zie `API-KEYS.md`). Zonder/ongeldige key → `401`.

## Tools
`list_media` · `list_catalog` · `upload_media_from_url` · `build_reel` (auto-reel) · `compose` · `grade` · `karaoke` · `reframe` · `sfx_mix` · `voiceover` · `export` · `open_in_editor`.
Een key ziet alleen tools binnen zijn scopes. Renders komen terug met `download_url` (Bearer-key nodig).
Typische flow: `upload_media_from_url` → `build_reel` / `compose` → `grade` → `karaoke` → download.

## Claude Desktop (`claude_desktop_config.json`)
```json
{ "mcpServers": { "dgdh-cut": {
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://studio.dgdh-os.com/api/mcp", "--header", "Authorization: Bearer ${CUT_API_KEY}"],
  "env": { "CUT_API_KEY": "cut_live_JOUW_KEY" } } } }
```
Claude (web/Desktop) custom connector die headers toestaat: URL `https://studio.dgdh-os.com/api/mcp`, header `Authorization: Bearer cut_live_JOUW_KEY`.

## Cursor (`~/.cursor/mcp.json`)
```json
{ "mcpServers": { "dgdh-cut": { "url": "https://studio.dgdh-os.com/api/mcp",
  "headers": { "Authorization": "Bearer cut_live_JOUW_KEY" } } } }
```

## ChatGPT (developer mode → Connectors → custom MCP)
Server-URL `https://studio.dgdh-os.com/api/mcp`, auth = custom header `Authorization: Bearer cut_live_JOUW_KEY`. (ChatGPT kan alleen OAuth of header-loze servers aanbieden in sommige plannen; gebruik dan REST hieronder via een GPT Action met `docs/openapi.yaml`.)

## Test met CLI
```
npx @modelcontextprotocol/inspector --cli https://studio.dgdh-os.com/api/mcp \
  --transport http --header "Authorization: Bearer cut_live_JOUW_KEY" --method tools/list
```
Of lokaal: `CUT_URL=… CUT_KEY=… bun apps/web/scripts/mcp-smoke.ts`.

## REST
Zelfde tools: `POST /api/v1/tools/<naam>` met JSON-args, `GET /api/v1/tools` (schema's), `GET /api/v1/usage`, `GET /api/v1/media/<file>`. Spec: `docs/openapi.yaml` (gegenereerd: `bun apps/web/scripts/gen-openapi.ts`).
```
curl -X POST https://studio.dgdh-os.com/api/v1/tools/grade -H "Authorization: Bearer cut_live_JOUW_KEY" \
  -H 'content-type: application/json' -d '{"file":"a.mp4","lut":"cinematic"}'
```
Foutcodes: 400 args ongeldig · 401 key · 403 scope · 422 tool/engine-fout · 429 rate limit (`Retry-After`) · 503 key-store down.

## Architectuur
`lib/agent-keys/tools.ts` is de enige tool-registry: MCP en REST dispatchen er allebei uit via `runTool` (scope-check, zod-validatie, usage-event). `src/proxy.ts` laat `/api/mcp` en `/api/v1/*` (behalve `/api/v1/keys`) door; de routes valideren zelf de Bearer-key (fail closed).
