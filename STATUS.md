# DGDH CUT (studio.dgdh-os.com) status

Laatst bijgewerkt: 2026-11-09

## Suite-SSO + bedrijfskeuze (contract 1. OPS/SUITE-SSO-ORG-CONTRACT.md): LIVE
- Klik in Suite = direct `/projects` (proxy: `/` is geen landing meer). `cut.dgdh-os.com/` redirect (gate `redirect_exact`) naar studio.
- Autorisatie: `src/proxy.ts` + `src/lib/suite-auth/{org,context,workspace}.ts`: sessie aal2, lidmaatschap `suite.organization_members` en recht `suite.entitlements` (app `cut`; dgdh/owned altijd). Cookie `suite-organization` is alleen voorkeur.
- Geen recht: `/geen-toegang` (NL, link naar Suite); API's 403 JSON. Fout in controle: 503 (fail closed).
- Tenant per organisatie: `public.cut_workspaces` (auto-onboarding, idempotent). Agent-keys, usage en server-projecten hebben nu `org` = organisatie-uuid (was user-id; alle oude cut-keys waren al ingetrokken).
- Bedrijfswisselaar: `BedrijfBalk` in layouts van `/projects` en `/agent` (alleen bij 2+ bedrijven met recht), POST naar `id.dgdh-os.com/api/organization`. Niet in de editor zelf.
- Machine-paden (`/api/mcp`, `/api/v1/tools|usage`, `/api/agent/*` met key) ongewijzigd. Bewijs: `docs/evidence/suite-sso-20261109/`.

## Deploy
- Image `dgdh-cut-web:20261109b-d08ded28` (commits 3883521c, d08ded28 op branch feat/suite-sso-org), lokaal gebouwd (amd64), `docker load` + `compose up --no-build` in `/opt/dgdh-cut-web`.
- Rollback app: `CUT_IMAGE_TAG=20261106g-5bd636be` in `/opt/dgdh-cut-web/.env` (backup `.env.bak-pre-20261109a`), dan `docker compose -f docker-compose.prod.yml up -d --no-build`. Beide vorige images worden vastgehouden door gestopte containers `dgdh-cut-web-rollback-*` (disk-guard prunet ongebruikte images bij >=85%).
- Rollback gate: Worker `dgdh-suite-gate` versie `6a9bc42c-847d-428f-b137-e6a5cca89195` (was actief, deployment 094f1831); nu `3cc78ead-61e1-47d9-a1ba-c7c4da907f15`. Alleen additief: `redirect_exact` voor `cut.dgdh-os.com` `/`.
- DB: `src/lib/agent-keys/schema-v3-workspaces.sql` (toegepast).

## Open
- Suite-tegel verwijst nog naar cut.dgdh-os.com (werkt via redirect); mooier is tegel-URL studio.dgdh-os.com.
- Engine (cut.dgdh-os.com) blijft alleen voor org-type dgdh, zonder eigen auth.
- Hetzner-schijf zat op 93-99% tijdens deploy.
