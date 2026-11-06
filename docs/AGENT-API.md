# DGDH CUT — Agent API (Fase 4)

Een agent bouwt headless een reel met de **CUT Engine** (`studio/server.py`, standaard `http://localhost:8765`)
en levert het af als **bewerkbaar OpenCut-project** in de UI. Alles hieronder is gebaseerd op de
echte handlers in `server.py` (alle responses: `{"ok": true, ...}` of `{"ok": false, "error": "..."}` + HTTP 4xx/5xx).

```
agent ──► build-reel.ts ──► Engine (:8765) ──► baked render + sources
                      └──► project JSON ──► agent-inbox / POST /api/agent/projects
UI:  /agent  ──► Import (IndexedDB/OPFS via storageService) ──► /editor/<id>
```

## 1. Engine-endpoints

Alle bestanden worden bij naam uit de **media-bin** (`INBOX`) opgelost: gebruik de `file`-naam uit `/api/media-bin`.
Uitvoer staat altijd weer in de media-bin; `preview` is `/media/<file>`. Via de web-app: prefix `/api/engine/`
(same-origin proxy, GET/POST).

| Methode | Pad | Body / query | Respons (belangrijkste velden) |
|---|---|---|---|
| GET | `/api/health` | – | `whisper, faster_whisper, ffmpeg, ventures, max_upload_mb` |
| GET | `/api/media-bin` | – | `items:[{file,url,kind:"video"\|"image",bytes,duration_s}]` |
| POST | `/api/media-upload` | multipart `file` (mp4 mov m4v webm jpg png webp heic; max 95 MB) | `file, preview, bytes` |
| GET | `/media/<file>` | – | bytes (Range-loos, `video/mp4`, …) |
| GET | `/api/sfx-library[?trending=1&days=60]` | – | `categories, sounds:[{file,category,duration_s,license,…}]` |
| GET | `/sfx/<file>` | – | wav |
| GET | `/api/transitions` · `/api/luts` · `/api/templates` · `/api/styles` | – | catalogi (luts: `bw cinematic cool teal-orange vintage …`; templates: `product-promo talking-head-reel cinematic-trailer`) |
| POST | `/api/auto-reel` | `{file, output_size?="1080x1920"}` | `id, preview, bytes, clips_used, captions_used, timeline:{clips:[{file,in,out}],captions:[{text,start,end}]}`; 400 `geen spraak gevonden` zonder spraak |
| POST | `/api/auto-reel/publish` | `{file, platform, tenantSlug?, text?}` | **expliciete losse stap**, nooit automatisch; faalt zonder `CUT_PUBLIC_URL`/`SOCIAL_API_*` |
| POST | `/api/compose` | `{timeline:{…}}` of `{template, clips:[file], title?, output_size?}`; optioneel `style`, `trending` | `id, preview, bytes, …` |
| POST | `/api/grade` | `{file, lut?, brightness?, contrast?, saturation?, gamma?}` | `id, preview, bytes` |
| POST | `/api/karaoke` | `{file, font_size?=44, highlight_color?="#FFE500", effect?="highlight"}` | `id, preview, words_used` (transcribeert; 400 zonder woorden) |
| POST | `/api/sfx-mix` | `{file, auto:true}` of `{file, cues:[{t,category}]}` | `id, preview, bytes` |
| POST | `/api/reframe` | `{file, output_size?}` | `preview, …` |
| POST | `/api/voiceover` | `{text, voice_id?, model?, file?}` | ElevenLabs; `ELEVENLABS_*` nodig |
| POST | `/api/effect` | `{file, effect, params}` | `preview` |
| POST | `/api/transition` | `{clips:[…], type?="fade", duration?=1.0}` | `preview` |
| POST | `/api/camera` | `{file, move, params?, ease?, fps?}` | `preview` |
| POST | `/api/text-anim` | `{text, preset?="word-pop", style?, timing?}` | frames/preview |
| POST | `/api/angles` | `{file, pattern?="story", cuts?="auto"}` | `preview` |
| POST | `/api/loudness` | `{file, audio_only?, target_lufs?=-14, true_peak_db?=-1.5, lra?=11}` | meting/normalisatie |
| POST | `/api/scenes` | `{file, threshold?=0.30, min_scene?=0.5, chapter_min_len?=30, titles?}` | scenes + chapters |
| POST | `/api/export` | timeline-JSON (≤2 MB), `preset?` (`9:16 1:1 4:5 16:9`), `format?` (`thumbnail\|gif`), `loop?` | `id, preview, bytes` |

### Compose-timeline (`/api/compose` → `timeline`)
```json
{ "output_size": "1080x1920",
  "clips": [ {"file":"a.mp4","in":0,"out":3,"grade":{"lut":"teal-orange"},
              "transition":"none","effects":[{"effect":"zoom","params":{"max":1.15}}]} ],
  "captions": [ {"text":"Hallo","start":0,"end":2.5,"size":56,"color":"white"} ],
  "sfx": [ {"t":0,"category":"hit"} ],
  "music": {"category":"music-bed"} }
```

## 2. Headless script

```bash
bun scripts/agent/build-reel.ts --media clip.mp4 [--media b.mp4] \
    [--brief brief.json] [--name "Reel"] [--out DIR | --post http://localhost:3104]
```
`--media` = lokaal pad (wordt via `/api/media-upload` geüpload) of een bestaande media-bin-naam.
Env: `CUT_ENGINE_URL` (default `http://localhost:8765`), `CUT_AGENT_INBOX` (default `./.agent-inbox`).
Stdout: één JSON-regel `{ok,id,name,duration_s,steps,render}`; logs op stderr; exit 1 bij fout.

`brief.json` (alles optioneel):
```json
{ "name":"…", "title":"Tekst over eerste clip", "output_size":"1080x1920",
  "autoReel": true,            // transcribe + stiltes knippen (1 spraakclip); valt bij geen spraak terug op volledige clip
  "clips":[{"file":"a.mp4","in":0,"out":3,"lut":"cinematic"}],
  "grade":{"lut":"teal-orange"}, "captions":[{"text":"","start":0,"end":2}],
  "sfx": true,                 // hit@0 + whoosh bij elke cut, of expliciete [{t,category}]
  "karaoke": false }           // brandt woord-captions in de baked render (tolerant: stap faalt → warning)
```
Stappen: upload → (auto-reel) → `compose` → (karaoke). Elke stap staat in `steps[]` met `ok`/`detail`.

## 3. Projectformaat `dgdh-cut-agent-project/v1`

```jsonc
{ "schema":"dgdh-cut-agent-project/v1",
  "project": {                       // = SerializedProject (services/storage/types.ts)
     "metadata":{"id":"<uuid>","name":"…","duration":720000,"createdAt":"ISO","updatedAt":"ISO"},
     "scenes":[{"id","name","isMain":true,"bookmarks":[],"createdAt","updatedAt",
       "tracks":{"main":{type:"video",elements:[…]},"overlay":[{type:"text",elements:[…]}],
                 "audio":[{type:"audio",elements:[…]}]}}],
     "currentSceneId":"…", "settings":{"fps":{"numerator":30,"denominator":1},"canvasSize":{"width":1080,"height":1920},…},
     "version":31 },
  "media":[{"id":"<uuid>","file":"a.mp4","role":"source|render","name","type":"video","url":"/api/engine/media/a.mp4","duration_s":3}],
  "engine":{"render":{"file":"compose-….mp4","preview":"/media/compose-….mp4"},"steps":[…]} }
```
- Tijd is in **ticks**: `TICKS_PER_SECOND = 120000` (`startTime, duration, trimStart, trimEnd, sourceDuration`, `metadata.duration`). Altijd integers.
- `trimEnd = sourceDuration − trimStart − duration`.
- `params` mogen leeg/sparse zijn; de import vult de standaardwaarden van de editor aan (`buildElementFromMedia`/`buildTextElement`/`buildLibraryAudioElement`). Tekst: `params.content`, `params.fontSize`.
- Video-element: `{type:"video",mediaId,…}` (verwijst naar `media[].id`). SFX: `{type:"audio",sourceType:"library",sourceUrl:"/api/engine/sfx/<file>",…}`.
- `media[].role:"render"` is de baked engine-render (ter vergelijking in de media-bin; staat niet op de tijdlijn). Bron-clips staan als losse, bewerkbare elementen op de hoofdtrack.
- `media[].file` moet een kale bestandsnaam zijn (geen `/` of `..`).

## 4. Next.js-routes

| Route | Doel |
|---|---|
| `POST /api/agent/projects` | body = payload hierboven; valideert schema/uuid/media, schrijft `<id>.json` in de inbox → `{ok,id,import:"/agent?id=<id>"}` (400 bij ongeldig) |
| `GET /api/agent/projects` | `{ok,items:[{id,name,duration,createdAt,mediaCount}]}` (nieuwste eerst) |
| `GET /api/agent/projects?id=<uuid>` | volledige payload (404 als onbekend) |
| `GET /agent` | inbox-UI: lijst, **Import** (haalt media via `/api/engine/media/*` → OPFS/IndexedDB, project → `storageService.saveProject`), daarna **Open in editor** → `/editor/<id>` |
| `GET /agent?id=<uuid>` | importeert direct bij laden |

Import is idempotent (project-id komt van de agent). Import draait **in de browser** (IndexedDB/OPFS zijn browser-opslag): een agent die het project klaar wil openen laat een browser `/agent?id=<id>` bezoeken (Playwright) en navigeert dan naar `/editor/<id>`.

## 5. Voorbeeld-flow

```bash
export CUT_ENGINE_URL=http://localhost:8765
bun scripts/agent/build-reel.ts --media a.mp4 --media b.mp4 --brief brief.json --post http://localhost:3104
# → {"ok":true,"id":"<id>",…}
# mens/agent opent http://localhost:3104/agent?id=<id>  →  "Open in editor"  →  /editor/<id>
```

## 6. Beperkingen / open punten
- Inbox is een map op de Next-server (`CUT_AGENT_INBOX`); op Cloudflare/OpenNext (geen fs) is die route niet bruikbaar — alleen Node-runtime (dev/Docker).
- Karaoke/sfx-baked renders zitten in de media-bin, niet als editbare lagen (karaoke-woordtiming wordt niet naar tekstelementen vertaald).
- Geen auth op `/api/agent/*`; zet achter hetzelfde netwerkscherm als `/api/engine/*`.
