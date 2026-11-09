# Suite-SSO + bedrijfskeuze, live bewijs (2026-11-09)

Testgebruikers via `1. OPS/tools/suite-e2e/suite_session.py` (TOTP, aal2). Image `dgdh-cut-web:20261109b-d08ded28`, gate-versie `3cc78ead`.
Gebruiker 1: bedrijf A (client, recht cut), B (client, geen recht), C (owned, geen rij). Gebruiker 2: alleen B.

| Test | Resultaat |
|---|---|
| A: studio.dgdh-os.com/ | 307 naar /projects, 200, geen landing |
| A: cut.dgdh-os.com/ | 302 naar studio, daarna /projects (browser: DGDH CUT, projectenoverzicht) |
| A+C: bedrijfswisselaar | zichtbaar, opties A en C (B ontbreekt, geen recht); wisselen via Suite-POST gaf actief bedrijf C |
| Cookie B bij gebruiker met A/C | valt terug op eerste bedrijf met recht (A) |
| Vervalste cookie (bedrijf waar je geen lid van bent) | genegeerd, actief bedrijf A |
| Gebruiker 2 (alleen B): / en /projects en /editor/abc | 307 naar /geen-toegang, NL pagina "Geen toegang tot CUT voor E2E B (tijdelijk)" met link naar Suite |
| Gebruiker 2: /api/v1/keys, /api/engine/x | 403 JSON |
| Tenant | public.cut_workspaces: rij voor A en C na eerste bezoek, 3 bezoeken = 1 rij per bedrijf, geen rij voor B |
| Key aanmaken als A | agent_api_keys.org = organisatie-uuid van A (niet meer user-id) |
| Anoniem studio: / /projects /geen-toegang /editor/x /agent | 307 naar id.dgdh-os.com/login?next=... |
| Anoniem machine-paden: /api/mcp, /api/v1/tools, /api/v1/keys, /api/engine, /api/export | 401 (ongewijzigd) |
| Anoniem cut.dgdh-os.com: /index.html 302 login, /api/export 401, /api/health 200 | ongewijzigd |
| Gate voor/na op 11 hosts x 3 paden + cookie-tests | alleen `cut /` verschilt (bedoeld) |
| Opruiming | harness: orgs 0, members 0, users 0; cut_workspaces 0; test-key 0 |

Screenshots: `A-start.png`, `A-na-wissel.png`, `B-start.png` (geen-toegang) in deze map.
