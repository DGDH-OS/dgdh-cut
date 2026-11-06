# Audit: zhaoxuya520/reverse-skill

Datum: 06-11-2026 · Methode: shallow clone (commit cab634b, 22-09-2026), alleen lezen/grep, niets geïnstalleerd of uitgevoerd. Clone: ~/.hermes/cache/scratch/reverse-skill-audit

## Wat het is
MIT-licentie. Skill-router voor reverse engineering en pentest (±45 skill-mappen: apk/ida/ghidra/frida/malware/pwn/wifi/windows-AD enz.), plus bootstrap-scripts (bash/ps1), een Burp-MCP-bridge (node, localhost) en een Kali-quick-setup. 600 bestanden, 13 MB.

## (a) Veiligheid
Geen malware of exfiltratie gevonden.
- Geen `curl|sh`, geen base64/eval/IEX in de eigen scripts. Alle hits zitten in `pentest-tools/src-hunter/.../payloader/raw/*.json`: een payload-naslag (reverse shells, webshells, SSTI). Dat is data en wordt niet uitgevoerd, maar AV/EDR kan erop alarmeren.
- Netwerk in scripts: GitHub API/releases, met SHA256-pins in `bootstrap-manifest.json` (+ `test-bootstrap-supply-chain`), apt, pip/npm met vaste versies, `pnpm --frozen-lockfile`. Burp-bridge praat alleen met 127.0.0.1.
- Geen credential-reads, geen telemetrie, geen auto-update.
- Consent-gate is echt: AGENTS.md zegt dat lezen ≠ toestemming om uit te voeren, en dat client-global config opt-in is.
- Aandachtspunten (geen malware, wel invasief):
  1. `bootstrap-reverse.sh` kan op verzoek `~/.claude/mcp.json` en `~/.codex/config.toml` wijzigen (MCP-registratie). Dit is client-global config.
  2. Het registreert remote MCP `https://xquik.com/mcp` (derde partij, X/Twitter-tool). Zo'n remote MCP krijgt tool-context; niet vertrouwen zonder aparte review.
  3. Installeert `sudo apt`, `npm -g`, `dpkg -i`, en `idalib-mcp`/jshookmcp/anything-analyzer (derde-partij repos, niet gevet).
  4. Plugin-homepage en tutorial staan op reverse.apivix.com (eigen site van de auteur). Ongevraagd gedrag daar niet gezien.
  5. De 44k sterren kunnen opgeblazen zijn (hourly star-history-widget). Geen reden voor extra vertrouwen.
- Niet gedaan: de 26 derde-partij MCP/tool-repos uit de manifest zijn niet gecontroleerd.

Oordeel: markdown-skills lezen is veilig. Als je ooit iets installeert: alleen `skills/**/*.md` kopiëren, nooit `scripts/`, `kali/`, `burp-mcp-full/`, `plugins/`, en bootstrap niet draaien. Voor Ruben/DGDH is er geen reden om het te installeren (zie b).

## (b) Nut voor CUT (video-editor)
Niet relevant. Het is puur security/RE (pentest, malware, exploit, firmware). Er zit niets over video, NLE, codecs, timeline, EDL/FCPXML/AAF/OTIO of editor-UX in. De enige RE-skills die enigszins raken zijn `macos-reverse` en `thick-client`, maar die zijn gericht op binaire analyse, niet op formaat-interoperabiliteit. Advies: niet installeren, geen skill van maken.

## (c) Juridische notitie: reverse engineering van commerciële editors
Geen juridisch advies; voor een echte beslissing een IE-jurist raadplegen (zie dgdh-law).

Kader: Softwarerichtlijn 2009/24/EG (NL: Auteurswet art. 45j–45n) en EULA's.
- Art. 5(3): proefondervindelijk observeren, bestuderen en testen van de werking van een programma om de onderliggende ideeën/principes te achterhalen mag bij normaal laden/draaien/opslaan door een rechtmatige gebruiker. Dit mag niet contractueel worden uitgesloten (art. 8).
- Art. 6: decompilatie alleen als dat onmisbaar is voor interoperabiliteit van een onafhankelijk gemaakt programma. Voorwaarden: rechtmatig gebruiker, informatie nog niet gemakkelijk beschikbaar, beperkt tot de daarvoor noodzakelijke delen. Verboden: gebruiken voor iets anders dan interoperabiliteit, doorgeven aan derden buiten die noodzaak, of gebruiken voor de ontwikkeling/verkoop van een in wezen soortgelijk programma of een andere auteursrechtinbreuk.
- Art. 1(2) / SAS v WPL (C-406/10): functionaliteit, programmeertaal en bestandsformaten zijn op zich niet auteursrechtelijk beschermd. Code (de uitdrukking) wel.
- Een EULA-verbod op RE is voor art. 6 en art. 5(3) nietig, maar daarbuiten (bv. alles wat verder gaat dan interoperabiliteit) kan het EULA-verbod wel gelden: contractbreuk, accountblokkade. Adobe/BMD/Apple EULA's verbieden decompileren expliciet; Resolve wordt ook onder licentievoorwaarden geleverd.
- Anti-circumvention (art. 6 Richtlijn 2001/29/EG, Aw art. 29a), licentie-/DRM-omzeiling en licentiecheck-patching vallen niet onder de uitzonderingen.

| Mag | Mag niet |
|---|---|
| Publieke docs en SDK's lezen: Resolve scripting API, FCPXML DTD, Premiere/AAF SDK, OTIO-docs | Binary decompileren om algoritmes, code of UI-logica over te nemen |
| Open formaten implementeren: EDL (CMX3600), FCPXML, AAF, OTIO, XML-export van Premiere, DRP-export waar gedocumenteerd | Gesloten/niet-gedocumenteerde formaten (.prproj, .drp interne structuur) reverse-engineeren buiten wat strikt voor interoperabiliteit nodig is, of die inzichten hergebruiken in een concurrerend product |
| Gedrag observeren als rechtmatige gebruiker: exports vergelijken, UI/feature-parity testen, timings meten, eigen testbestanden analyseren (black-box) | Licentiecheck/DRM omzeilen, netwerkverkeer van cloudfuncties/AI-features nabouwen, ToS-API's scrapen |
| Features/ideeën/workflows zelf opnieuw ontwerpen (clean-room) | Assets, icons, presets, LUTs, effect-code of UI-teksten kopiëren; merk- of trade-dress nabootsen |
| Marketing/pricing/feature-vergelijking van publieke bronnen | Trial/licentie-sleutels delen of gecrackte builds gebruiken |

Aanbevolen werkwijze voor CUT: (1) interop via OTIO/FCPXML/EDL op basis van publieke specs; (2) concurrentie-analyse via publieke docs, release notes, review-video's en black-box gebruik; (3) clean-room: wie binaries bekeek schrijft geen code in CUT; (4) bronnen en datum noteren in COMPETITIVE/; (5) bij twijfel over een formaat: jurist, niet decompileren.
