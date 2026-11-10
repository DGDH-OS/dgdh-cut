# DGDH CUT (dgdh-cut, Next.js app apps/web)

- Host: studio.dgdh-os.com (Hetzner `/opt/dgdh-cut-web`, compose, Traefik). cut.dgdh-os.com is de Engine (apart repo dgdh-cut-engine) achter de suite-gate; `/` daar gaat naar studio.
- Auth: Suite-cookie, `src/proxy.ts`. Org-keuze en recht: `src/lib/suite-auth/org.ts` (puur, getest), `context.ts` (server), `workspace.ts` (tenant `public.cut_workspaces`). Contract: `1. OPS/SUITE-SSO-ORG-CONTRACT.md`. Cookie is voorkeur, nooit autorisatie.
- `org` in agent-keys/usage/projecten = Suite organization_id.
- Nooit een route zonder sessie of key openzetten: machine-paden zijn `/api/mcp`, `/api/v1/*` (behalve keys), `/api/agent/*` (key of sessie), `/api/health`.
- Deploy: image lokaal bouwen (`docker buildx build --platform linux/amd64 --output type=docker,dest=...`), `cat tar | ssh dgdh-os docker load && compose up -d --no-build` in EEN ssh-commando (disk-guard prunet ongebruikte images). Rollback-punt eerst noteren.
- Teksten Nederlands, Atelier, geen em-dash, geen emoji.
- Agent-surface (10-11-2026 live): `upload_media_from_url` is SSRF-veilig (`safe-fetch.ts`), `publish_to_social` heeft geen `tenant_slug` meer. Live image tag `20261110a-5a2f0b69`, bouw lokaal.
