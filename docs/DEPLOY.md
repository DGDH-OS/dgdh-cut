# DGDH CUT web: deploy (Fase 5)

Status: voorbereid en lokaal getest. Niet gedeployed.

## Hostnaam-keuze
`studio.dgdh-os.com`. `cut.dgdh-os.com` is al de live CUT Engine (shortform-video studio);
hergebruik zou die breken. "studio" is kort, vrij van conflicten en past bij "DGDH CUT Studio".
Wijzigen = `Host(...)` in `docker-compose.prod.yml`, `CUT_APP_URL` en `NEXT_PUBLIC_SITE_URL`.

## Architectuur
- `Dockerfile` (root, build-context = repo-root, Next standalone, user `nextjs`, geen secrets; alleen
  niet-geheime build-placeholders voor env-validatie). `Dockerfile.dockerignore` houdt host-`node_modules` buiten de context.
- `docker-compose.prod.yml`: service `web`, netwerk `coolify` (extern), Traefik-labels (http->https, gzip, letsencrypt), poort 3000.
- Auth: `src/proxy.ts` (Next 16 proxy) + `src/lib/suite-auth/*`. Alle routes achter Suite-sessie
  (Supabase cookie op `.dgdh-os.com`, niet-anoniem, MFA aal2); fail-closed als Supabase-env ontbreekt.
  Pagina's: 307 naar `id.dgdh-os.com/login?next=...`; `/api/*` (incl. `/api/engine`, `/api/export`, `/api/auth`): 401 JSON.
  Publiek: alleen `/api/health`, `/_next/static/*`, favicon, robots.txt en `/fonts|icons|logos|flags|effects/*`.
- Dev-bypass: `CUT_DEV_AUTH=1` + `CUT_APP_URL=http://localhost:PORT` + `NODE_ENV!=production`. In de prod-image is hij dood (getest).

## Env-vars (alleen namen; waarden uit Infisical dgdh-platform)
Runtime, verplicht: `CUT_ENGINE_URL` (intern engine-adres), `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `MARBLE_WORKSPACE_KEY`, `FREESOUND_CLIENT_ID`, `FREESOUND_API_KEY`.
Met default: `CUT_APP_URL` (https://studio.dgdh-os.com), `SUITE_LOGIN_URL` (https://id.dgdh-os.com/login),
`AUTH_COOKIE_DOMAIN` (.dgdh-os.com), `NEXT_PUBLIC_MARBLE_API_URL`, `CUT_IMAGE_TAG`.
Zet NOOIT `CUT_DEV_AUTH` in productie. `NEXT_PUBLIC_*` worden alleen in de proxy server-side gelezen (geen rebuild nodig).

## Stappen
1. DNS (Cloudflare): A `studio` -> 167.233.154.161 (Ruben/DNS-token).
2. Env zetten in Coolify of `.env` op de server (render uit Infisical).
3. Image bouwen buiten de server (Hetzner OOM-risico, zie skill dgdh-hetzner-deploy): lokaal
   `docker buildx build --platform linux/amd64 -t dgdh-cut-web:<tag> .`, `docker save | ssh dgdh-os docker load`,
   of via Coolify (concurrent_builds=1).
4. `CUT_IMAGE_TAG=<tag> docker compose -f docker-compose.prod.yml up -d`.
5. Verifieer (hieronder).

## Healthcheck / verificatie
- Container: `wget --spider http://127.0.0.1:3000/api/health` (in Dockerfile `HEALTHCHECK`), 200 "OK".
- Anoniem: `curl -I https://studio.dgdh-os.com/` -> 307 naar id.dgdh-os.com; `curl -i .../api/export -X POST` -> 401.
- Ingelogd (Suite, aal2) in de browser: editor laadt, exportknop bereikt `CUT_ENGINE_URL`.

## Lokaal testen
Dev: `CUT_DEV_AUTH=1 CUT_APP_URL=http://localhost:3000 bun run dev` (env-stubs voor DATABASE_URL e.d. nodig).
Prod-image: `docker build -t dgdh-cut-web:test .` en `docker run -p 3077:3000 -e ... dgdh-cut-web:test`.

## Open punten
- Interne engine-URL onbekend: engine is nu publiek op cut.dgdh-os.com. Voorkeur: engine op `coolify`-netwerk, `CUT_ENGINE_URL=http://<container>:8765`.
- `/api/engine` en `/api/export` hebben geen eigen per-route sessiecheck (buiten scope-pad); alleen proxy. Voeg
  `getSuiteSession` toe in die routes als defense-in-depth.
- Entitlement/org-check (zoals CALL) ontbreekt: elke Suite-gebruiker met aal2 komt erin.
- `/api/engine` stuurt geen auth naar de engine; engine moet via netwerk afgeschermd zijn.
