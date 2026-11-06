# DGDH CUT: feature-inventaris en matrix

Datum: 2026-11-06. CUT-kolom = geverifieerd in repo `1. OPS/tool-pilots/opencut/classic` (`apps/web/src`, `rust/crates`, `docs/*`) en `1. OPS/tools/shortform-video/studio/server.py`. Concurrentkolommen = algemene kennis, behalve waar `FCP-AI-EDITORS.md` een bron geeft; onzeker = *te verifiëren*. Status CUT: **heeft / deels / mist**. "Mist" = niet gevonden in code, niet uitgebreid getest.

Deploystatus (PRIJZEN-APPS.md): cut.dgdh-os.com live met oude versie; nieuwe timeline/export nog niet gedeployd. Niets hieronder is met een runtime-test door mij geverifieerd, alleen code/docs gelezen.

## Matrix

| Categorie | CUT | Resolve | Premiere | FCP | CapCut |
|---|---|---|---|---|---|
| Multitrack timeline, snapping, ripple | **heeft** (`timeline/`, `ripple/`, snapping, groepsmove/-resize) | heeft | heeft | heeft (magnetisch) | heeft |
| Magnetic/ripple-achtig bewerken | deels (ripple-modul, geen magnetische storyline) | deels | deels | heeft | deels *te verifiëren* |
| Keyframes + curves | **heeft** (`animation/`: bezier, graph-channels) | heeft | heeft | heeft | heeft |
| Snelheid/retime | **heeft** (`retime/` met presets, audio-stretch) | heeft | heeft | heeft | heeft |
| Masks | **heeft** (9 vormen + freeform, feather) | heeft | heeft | heeft + AI Magnetic Mask (bron) | heeft + AI *te verifiëren* |
| AI-subject-masking/rotoscoping | **mist** | heeft | heeft | heeft (alleen Mac, bron) | heeft *te verifiëren* |
| Effecten (clip) | deels (client: alleen blur; server: 15 effecten via `/api/effect`) | heeft (veel) | heeft (veel) | heeft (veel) | heeft |
| Overgangen | deels (58 via engine `/api/transition`, niet als timeline-element bevestigd) | heeft | heeft | heeft | heeft |
| Kleur: LUTs / basis-grade | deels (6 LUTs + brightness/contrast/saturation/gamma via `/api/grade`, panel) | heeft (top) | heeft (Lumetri) | heeft | deels |
| Kleur: wielen, curves, scopes | **mist** (niet gevonden) | heeft | heeft | heeft | deels *te verifiëren* |
| Audio: mixer + loudness | **heeft** (`mixer-panel`, `/api/loudness` LUFS -14) | heeft (Fairlight) | heeft | heeft | deels |
| SFX-bibliotheek | **heeft** (109 SFX, auto sfx-mix) | deels | deels | heeft (content) | heeft |
| Muziek-beat-detectie / auto-sync | **mist** | deels *te verifiëren* | deels *te verifiëren* | heeft (Beat Detection, bron) | heeft *te verifiëren* |
| Audio-scheiding (stem/voice isolation) | deels (`timeline/audio-separation`: scheiden audio van video; geen AI-isolatie bevestigd) | heeft | heeft | heeft Voice Isolation (bron) | heeft *te verifiëren* |
| Transcriptie in de browser | **heeft** (whisper tiny/small/medium via ONNX/HF, `transcription/`) | heeft (Studio) | heeft | heeft (alleen US-Engels, bron) | heeft |
| Server-transcriptie (faster-whisper) | **heeft** (`/api/health` meldt whisper/faster_whisper) | nee | nee | nee | n.v.t. |
| Auto-captions + stijl | **heeft** (captions, ASS/SRT import, karaoke baked + `/api/karaoke`) | heeft | heeft | heeft | heeft |
| Transcript-based editing (tekst = video) | **mist** (alleen captions, geen knippen via tekst) | heeft *te verifiëren* | heeft | deels (zoeken, geen tekst-edit) | deels *te verifiëren* |
| Auto-reel (stiltes knippen + captions) | **heeft** (`/api/auto-reel`, `build_reel`) | nee | deels (Text-based, filler detection *te verifiëren*) | nee | heeft *te verifiëren* |
| Auto-publish | deels (`/api/auto-reel/publish`, vereist `CUT_PUBLIC_URL`/`SOCIAL_API_*`, losse stap) | nee | nee | nee | heeft |
| Reframe 9:16/1:1/4:5 | **heeft** (`/api/reframe`, export presets) | heeft | heeft (Auto Reframe) | heeft (Auto Crop, bron) | heeft |
| Scene-detectie/chapters | **heeft** (`/api/scenes`) | heeft | heeft | heeft (Edit Detection, bron) | heeft *te verifiëren* |
| Multicam | **mist** (`/api/angles` is automatische hoek-pattern, geen multicam-sync) | heeft | heeft | heeft (bron) | mist *te verifiëren* |
| Tekst/titels + animaties | **heeft** (text, 12 text-anim presets) | heeft | heeft | heeft | heeft |
| Stickers/vormen | **heeft** | deels | deels | heeft | heeft |
| Voiceover / TTS | **heeft** (ElevenLabs, panel + endpoint) | deels | deels | nee | heeft |
| Templates | deels (3 templates: product-promo, talking-head-reel, cinematic-trailer) | deels | heeft | heeft | heeft (veel) |
| Live preview-engine | **heeft** (Rust/WASM + WebGPU compositor) | heeft (GPU) | heeft | heeft | heeft |
| Export | **heeft** (server ffmpeg: 4 presets, GIF, thumbnail) | heeft (4K+, ProRes etc.) | heeft | heeft | heeft |
| Export-codecs pro (ProRes/HDR/RAW) | **mist** | heeft | heeft | heeft | mist |
| XML/FCPXML/EDL uitwisseling | **mist** | heeft | heeft | heeft (FCPXML 1.14, bron) | mist |
| Workspaces/panelen | deels (4 presets: Bewerken, Kleur, Audio, Ondertitels; geen vrij docken bevestigd) | heeft | heeft | deels | nee |
| Samenwerking/review | **mist** | heeft | heeft | zwak (bron Reddit) | deels |
| Agent-API (REST/MCP) | **heeft** (12 MCP-tools, scopes, rate limit, usage, OpenAPI; headless `build-reel.ts`) | mist (Python scripting API, geen cloud-MCP *te verifiëren*) | mist *te verifiëren* | mist | mist *te verifiëren* |
| Agent-project terug in editor | **heeft** (`/agent` import, `dgdh-cut-agent-project/v1`) | nee | nee | nee | nee |
| Server-render / headless | **heeft** | deels | deels | nee | deels |
| Platform | Browser (+ desktop-map aanwezig, status onbekend) | Win/Mac/Linux | Win/Mac | Mac/iPad | Web/mobiel/desktop |
| Prijs | PAYG + EUR 7/12/39 per maand (concept, nog niet live) | gratis + eenmalig *te verifiëren* | abonnement | $299,99 of $12,99/mnd (bron) | Pro $19,99 (bron PRIJZEN) |

## Kernstatus CUT
- **Engine**: ~24 endpoints (8 GET: health, catalog, media-bin, sfx-library, transitions, luts, templates, styles; 16 POST: export, auto-reel, auto-reel/publish, karaoke, reframe, voiceover, sfx-mix, transition, effect, grade, compose, loudness, scenes, camera, text-anim, angles, media-upload). Bibliotheken: 109 SFX, 6 LUTs, 5 styles, 58 transitions, 15 effects, 12 text-anim (BOUWPLAN).
- **UI**: OpenCut-fork met engine-panels (grade, karaoke, reframe, voiceover, media-picker), mixer, 4 workspaces (NL-labels).
- **Agents**: MCP `https://studio.dgdh-os.com/api/mcp` met 12 tools (list_media, list_catalog, upload_media_from_url, build_reel, compose, grade, karaoke, reframe, sfx_mix, voiceover, export, open_in_editor), REST `/api/v1/tools/<naam>`, key-scopes (`docs/MCP.md`, `lib/agent-keys/tools.ts`).
- **Beperkingen uit docs**: agent-inbox werkt alleen met Node-runtime (niet Cloudflare/OpenNext); `/api/agent/*` zonder auth; karaoke/sfx zijn baked, niet bewerkbaar op tijdlijn; upload max 95 MB, export-timeline max 2 MB; onbekend of nieuwe versie live staat.

## Grootste gaten
1. Geen magnetische timeline/multicam, geen pro-codec/XML-uitwisseling.
2. Kleur: geen wielen/curves/scopes.
3. Geen AI-masking, beat-sync, voice isolation.
4. Transcript-editing ontbreekt, terwijl transcriptie er al is.
5. Geen collaboration/review; klein templates-aanbod (3).
6. Edit-uitkomsten van engine (karaoke, sfx, grade) zijn "baked" i.p.v. editbare lagen.
7. Agent-inbox niet Cloudflare-compatibel, geen auth; nieuwe versie niet gedeployd.

## Top 15 onderscheidende features (effort S/M/L)

| # | Feature | Differentiator | Effort |
|---|---|---|---|
| 1 | **Transcript-editing**: tekst verwijderen = timeline knippen (hergebruik whisper-output, ripple-module) | transcript-editing, concurreert met Descript-kern | M |
| 2 | **Prijs-voorvertoning per call** in MCP/UI ("deze render kost EUR 0,32") + hard budget per key | goedkoper PAYG, lost credit-klachten Descript/Opus op (zie FCP-AI-EDITORS) | S |
| 3 | **Betaal alleen voor geaccepteerde export** (geen bronminuut-afrekening zoals Opus) | PAYG-wig | M |
| 4 | **Nederlandse captions op niveau** (NL-whisper-model, NL-filler-woorden, NL-stijlpresets) | NL-markt; FCP-captions alleen US-Engels (bron) | S |
| 5 | **Auto-reel v2**: highlight-selectie op transcript (hook-detectie) i.p.v. alleen stiltes knippen, meerdere kandidaten + score | auto-reel, Opus-alternatief | M |
| 6 | **Editbare agent-uitvoer**: karaoke/sfx/grade als tijdlijnlagen i.p.v. baked | agent-first; open punt in AGENT-API §6 | L |
| 7 | **MCP-uitbreiding**: tools voor scenes, loudness, camera, text-anim, angles, effect, transition, edit-timeline (add/trim/move) | agent-first volledig | M |
| 8 | **Agent-project via MCP/REST zonder browser-import** (server-side project-opslag, Cloudflare-compatibel) + auth op `/api/agent/*` | agent-first, blokkade voor deploy | M |
| 9 | **EU-hosting-belofte + verwerkersovereenkomst** (Hetzner, geen training op media) | AVG/EU; CapCut krijgt privacykritiek (PCMag-kop) | S |
| 10 | **Batch/lange-bron-pipeline**: 1 upload → N reels (9:16/1:1/4:5) + untertitels in 1 call | server-render, schaal | M |
| 11 | **Branded kits per tenant** (fonts, kleuren, outro, LUT, caption-stijl) toepasbaar door agent | DGDH Suite multi-tenant, agency-use | M |
| 12 | **Beat-sync/auto-cut op muziek** (server: ffmpeg/librosa) | gat vs FCP | M |
| 13 | **FCPXML/EDL/SRT export** zodat pro's verder kunnen in FCP/Resolve | brug naar pro, verlaagt "lock-in"-vrees | M |
| 14 | **Kleur-basis**: wielen/curves + simpele scopes op bestaande WASM-compositor | kleurgat dichten | L |
| 15 | **Publish-flow naar DGDH Social** (planning + captions-varianten), altijd met expliciete bevestiging | end-to-end suite; bestaat deels | S |

Volgorde-suggestie voor ROI: 2, 4, 9, 1, 7, 8, 5, 3.
