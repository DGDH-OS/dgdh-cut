# CUT API-keys, rate limits & metering

- **Aanmaken/lijst/intrekken**: `POST|GET|DELETE /api/v1/keys` — alleen met Suite-browsersessie (aal2). Org = Suite-user-id. Body: `{name, scopes?, rate_limit_per_min?}`. De sleutel (`cut_live_…`) wordt **één keer** getoond. Admin zonder browser: `bun scripts/agent/create-key.ts --org <id> --name "Klant"`.
- **Opslag**: alleen `sha256(key)` + prefix. Supabase (`agent_api_keys`, schema `apps/web/src/lib/agent-keys/schema.sql`, service-role, RLS aan zonder policies) als `CUT_SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` gezet zijn; anders bestandsstore in `CUT_AGENT_KEYS_DIR` (default `./.agent-keys`, keys.json + usage.jsonl — op Coolify een volume mounten).
- **Scopes**: `media:read media:write render transcribe voice editor`. Tool→scope staat in `tools.ts`.
- **Rate limit**: per key, vaste minuut-window in-memory (default 60/min, max 600), `429` + `Retry-After`.
- **Usage-events** (append-only, 1 per call, ook bij fouten met `units:0`): `{key_id, org, tool, units, ts, status, ms, channel}`. Tabel `agent_usage_events` (trigger blokkeert update/delete) of `usage.jsonl`. Units per tool staan in `tools.ts` (1 lijst … 10 transcriptie). Pricing leest hier pay-as-you-go uit; `GET /api/v1/usage` geeft een per-tool-samenvatting.
- **Env**: `CUT_APP_URL` (links in resultaten), `CUT_ENGINE_URL`, `CUT_AGENT_KEYS_DIR`, `CUT_SUPABASE_SERVICE_ROLE_KEY`. De Supabase-migratie is nog NIET toegepast (geen DB-wijzigingen gedaan).
