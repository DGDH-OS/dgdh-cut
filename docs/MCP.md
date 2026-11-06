# DGDH CUT via MCP & REST

CUT is bestuurbaar door elke agent. Endpoint (Streamable HTTP, stateless):

```
https://studio.dgdh-os.com/api/mcp        Authorization: Bearer <CUT_API_KEY>
```

Een key maak je aan in de Suite (zie `API-KEYS.md`). Zonder/ongeldige key → `401`.

## Tools
Media/render: `list_media` · `list_catalog` · `upload_media_from_url` · `build_reel` (auto-reel) · `compose` · `grade` · `karaoke` · `reframe` · `sfx_mix` · `voiceover` · `export`.
Analyse/audio (v2): `detect_scenes` (→ `/api/scenes`, scenes + chapters) · `measure_loudness` (LUFS; the engine has no measure-only endpoint, so it runs an audio-only pass and discards the file) · `normalize_loudness` (→ `/api/loudness`).
Projects (v2, server-side, no browser import needed): `list_projects` · `get_project` (ids + times in seconds) · `edit_timeline` · `open_in_editor`.
Money (v2): `estimate` · `accept_export`. Social (v2): `publish_to_social` (scope `publish`, **draft only**, delegates to the engine's `/api/auto-reel/publish`; fails with a clear message until `SOCIAL_API_*`/`CUT_PUBLIC_URL` are set on the engine).
Een key ziet alleen tools binnen zijn scopes. Renders komen terug met `download_url` (Bearer-key nodig).
Typische flow: `upload_media_from_url` → `build_reel` / `compose` → `grade` → `karaoke` → download.

## Prijs-voorvertoning, budget en betalen-bij-acceptatie (v2)
- **Dry run**: elke tool accepteert `dry_run: true` (MCP en REST) of roep `estimate {tool, args}` aan. Antwoord: `estimate.lines[{unit, quantity, rate_eur, eur, basis}]`, `units`, `eur`, `gated`, plus `budget` (limieten, besteed, resterend) en `would_be_allowed`. Er wordt niets uitgevoerd en er komt geen usage-event. Prijzen komen uit `tools/pricing/pricing.json` (CONCEPT, niet live; `lib/agent-keys/pricing.ts`, check met `bun scripts/agent/check-pricing.ts`). Hoeveelheden worden naar boven afgerond op 0,1 eenheid (min 0,1). Lengte-onbekend (engine onbereikbaar of niet in media-bin) → 60 s aangenomen, `assumed: true`.
- **Budget per key**: `budget_eur_month` (UTC-kalendermaand) en `budget_units_day` (UTC-dag, som van factureerbare eenheden). Vooraf gecontroleerd op de geschatte kosten: **402** `budget_exceeded` (maand-EUR) of **429** `daily_units_exceeded` (+ `Retry-After` tot middernacht UTC), met `message`, `budget` en `estimate`. Geblokkeerde calls draaien niet en schrijven geen event. Pending renders tellen mee als gereserveerd; een gevoide render geeft budget vrij. Race: gelijktijdige calls kunnen het budget licht overschrijden (geen lock).
- **Betalen alleen voor geaccepteerde export**: renders (`build_reel compose grade karaoke reframe sfx_mix export normalize_loudness`) schrijven een usage-event met `state: "pending"` en geven `usage.event_id` terug. `accept_export {usage_event_id, accepted}`: `true` → definitief gefactureerd, `false` → `voided` (EUR 0). Zonder actie wordt een pending render na **24 u automatisch geaccepteerd**. Het event zelf blijft onveranderd (append-only); `accept_export` voegt een resolutie-event toe (`ref` = render-event). Niet-render tools (voiceover, lijst/analyse/projecten) zijn direct definitief; analyse en projecttools zijn gratis.

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
Foutcodes: 400 args ongeldig · 401 key · 402 maandbudget op · 403 scope · 422 tool/engine-fout · 429 rate limit of daglimiet (`Retry-After`) · 503 key-store down.

## Architectuur
`lib/agent-keys/tools.ts` is de enige tool-registry: MCP en REST dispatchen er allebei uit via `runTool` (scope-check, zod-validatie, usage-event). `src/proxy.ts` laat `/api/mcp`, `/api/agent/*` en `/api/v1/*` (behalve `/api/v1/keys`) door; de routes valideren zelf de Bearer-key (fail closed).

## Tests
`bun scripts/agent/test-agent-api.ts` (MCP-SDK-client + REST; 58 checks: tools/list, calls, dry_run/estimate, budget 402/429, 401, usage-events, accept/void, project-store, edit_timeline). Draai met `CUT_URL`, `CUT_KEYS_DIR` (= `CUT_AGENT_KEYS_DIR` van de server) en de engine op `:8765`.
