# BOUWPLAN — DGDH CUT (v2)

Datum: 2026-11-05
Auteur: DGDH OS (Orchestrator)

## Decisions (locked door Ruben, 2026-11-05)

1. **Hybride architectuur.** OpenCut classic UI + WASM/WebGPU live-preview blijven client-side.
   De professionele eindrender + agent-API lopen via de bestaande DGDH CUT ffmpeg-server
   (server-side). UI stuurt timeline als JSON naar de server; agents sturen dezelfde API headless.
2. **Visuele stijl: DGDH huisstijl (messing/ivoor).** OpenCut dark-look wordt vervangen door de
   DGDH-tokens: messing + ivoor (cream/beige), charcoal text, WCAG AAA, geen gradients, geen emoji,
   geen shadows dieper dan 4px. Fraunces (headings), IBM Plex Mono (code/timing). Bron:
   skill `dgdh-shortform-video-studio` §3 + Atelier v3 tokens (`dgdh-design-system`). Geen nieuw palet.
3. **Naam: DGDH CUT.** De nieuwe OpenCut-gebaseerde editor heet DGDH CUT. De bestaande Python/ffmpeg
   engine (`1. OPS/tools/shortform-video/studio/`, live op cut.dgdh-os.com) wordt aangeduid als
   **"CUT Engine"** en blijft de render-/agent-backend achter de nieuwe UI.

## Architectuur (doelbeeld)

```
DGDH CUT (nieuw, OpenCut-fork UI)
 ├── Frontend: Next.js (OpenCut classic), gerebrand + DGDH-huisstijl
 ├── Live preview: Rust/WASM compositor + WebGPU (client-side, blijft)
 ├── Timeline/panels: OpenCut timeline + Premiere Pro-achtige workspaces
 │      (Lumetri-grade = onze 6 LUTs, Audio-mixer = onze SFX/loudness, dockable panels)
 └── Export/eindrender → JSON timeline → CUT Engine (ffmpeg-server)

CUT Engine (oud project, blijft)
 ├── server.py: ~25 REST-endpoints (compose, grade, sfx-mix, karaoke, reframe,
 │     voiceover, loudness, scenes, camera, text-anim, angles, effect, transition, export)
 ├── Bibliotheek: 109 SFX, 6 LUTs, 5 styles, 58 transitions, 15 effects, 12 text-anim
 └── = agent-API: agents produceren headless, resultaat laadt als bewerkbaar project in UI
```

## Fases

| # | Fase | Deliverables | Test gate |
|---|---|---|---|
| 0 | Fundament + rebrand | fork hernoemd `DGDH-OS/dgdh-cut`, naam/logo "DGDH CUT", DGDH-huisstijl (messing/ivoor) toegepast, CLAUDE.md/AGENTS.md voor de fork, mijn 6 bit-rot-fixes gecommit | `bun run build` groen, rebrand zichtbaar in UI, huisstijl op de editor-shell |
| 1 | Render-koppeling | timeline-JSON → CUT Engine `/api/export`; export-knop stuurt naar server; resultaat terug in UI | export via server rendert MP4 met captions (Docker), 0 console-errors |
| 2 | Onze features als panels | SFX-bibliotheek, LUTs (Lumetri-grade), karaoke-captions, reframe, voiceover als UI-panelen | elke feature vanuit UI + end-to-end getest |
| 3 | Premiere Pro workspaces | dockable panels, program/source monitor-refinement, audio-mixer, workspaces | visual gate + mobile gate groen |
| 4 | Agent-first | agent-API-doc + headless pipeline; agent bouwt reel → verschijnt als project in UI | agent bouwt reel headless, laadt in UI |
| 5 | Deploy Hetzner | Coolify/Traefik, achter Suite-login (id.dgdh-os.com), 24/7 | live test via cut.dgdh-os.com |

## Regels (altijd)

- Één fase tegelijk. Fase N+1 pas na groene gate N én akkoord Ruben.
- Builder werkt lokaal (geen git push, geen Coolify, geen Infisical, geen ads, geen mail).
- Tests zijn gates, geen richtlijn. Geen "mostly working".
- Reuse, never rebuild: CUT Engine blijft de render-backend; geen ffmpeg-logica dupliceren in de UI.
- Verifieer zelf (Prove-gate), vertrouw geen builder-summary.

## Volgende actie

Fase 0 delegeren aan @dgdh-builder. Push pas na expliciete ja van Ruben.
