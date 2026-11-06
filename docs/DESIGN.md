# DGDH CUT: design (DGDH Atelier v3)

Bron van waarheid: `1. OPS/one-stack/design-system/` (DESIGN.md, dgdh-atelier.css) en de live site (`atelier.css`).
Alle tokens staan in `apps/web/src/app/globals.css`. Geen hex in components; gebruik de semantische Tailwind-klassen.

## Tokens
| Token | Waarde | Gebruik |
|---|---|---|
| canvas / `bg-background` | #121212 (body: vaste gradient #0a0c0e + racing-green/brons radials) | pagina |
| `surface` (`bg-card`, `.panel`) | #161a21 | editor-panelen, kaarten |
| `surface-raised` (`bg-muted`, `bg-accent`) | #1e232c | hover, secundaire knop |
| `foreground` | #f8f7f4 | tekst, primaire knop (`bg-primary`, tekst #161a11) |
| `muted-foreground` | #a7a9ae | meta, captions |
| `brand` | #00665e racing green | actieve workspace-tab, focus-ring (binnenkant), merkvlak |
| `bronze` | #b58c67 | lijnen, iconen, handles, vlakken (NIET voor tekst) |
| `bronze-text` (`text-bronze-text`, `.eyebrow`) | #c8aa8e | bronze TEKST op donker: eyebrows, caution-tekst. Canvas 8,54:1 · surface 8,08:1 · raised 7,22:1 (AAA). Op licht vlak: #6b4e34 (7,6:1 op wit) |
| `border` / `border-strong` | #2a303b / #707379 | hairlines / inputs |
| `destructive` / `constructive` | #e0584f / #3fa37a | alleen samen met icoon of tekst |

## Vorm
- Radius: kaarten/dialogen 24px (`rounded-lg`), knoppen/menu's 14px (`rounded-md`), dichte controls 10px (`rounded-sm`). Geen 0 of 2px.
- Zwevend oppervlak (dialoog, menu, toast, popover, sheet, header, footer): utility `glass` (blur 28px, saturate 1.35, hairline, inset highlight).
- Geen andere schaduwen (`--shadow-*: none`) en geen gradients behalve het canvas.
- Dark-only: `forcedTheme="dark"`, themawissel verwijderd.

## Typografie
- UI en koppen: Albert Sans (next/font, variabele `--font-albert-sans`, gezet op `<html>`). Koppen h1-h3: 500, uppercase, +0.02em.
- Timecodes/code: IBM Plex Mono, tabulaire cijfers.
- Kleinste tekst 12px (`text-xs`), geen `text-[10px]`, geen opacity-gedimde tekst.
- Eén punt om de fontfamilie te wisselen: `--font-ui` in globals.css + de `Albert_Sans`-import in `layout.tsx`.

## Regels
- Geen emoji (iconen via hugeicons/lucide). Geen pure #000/#FFF in styling.
- Statuskleuren nooit alleen: altijd icoon of tekst erbij.
- Merknaam altijd "DGDH CUT". Interne identifiers (`opencut-wasm`, `@opencut/web`, DB-namen) blijven staan.
- Logo: `public/logos/dgdh-cut/` (symbol, text, logo, -light varianten); favicon en app-iconen daaruit gegenereerd.

## Contrast (gemeten met Playwright over landing, projects, onboarding, 4 workspaces)
Zie `docs/design-evidence/`. 171 unieke tekstkleuren-combinaties: 159 haalden AAA (7:1). De rest: tekst op groen 6,4:1 (AA), drop-zone-tekst nu `foreground`, uitgeschakelde knoppen (vrijgesteld).
