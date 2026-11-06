# Transcript-bewerken (DGDH CUT)

Tab **Transcript** in het assets-paneel. Eigen ontwerp, geen code van derden.

## Werking
1. **Transcriberen**: audio van de hele tijdlijn (`extractTimelineAudio`) wordt in de browser met Whisper (transformers.js, eigen worker `services/transcript/worker.ts`) omgezet naar woorden met tijden. Taal: Nederlands standaard (ook en, de, fr, es, it, pt). Woord-timestamps vragen een `_timestamped`-export van het model (`onnx-community/whisper-<model>_timestamped`); het gewone model geeft de fout "cross attentions". Standaardmodel: small.
2. **Klik op woord** = seek; Shift+klik = bereik selecteren; Delete/Backspace of knop "Verwijder selectie" = ripple-delete.
3. **Vulwoorden** (uh, uhm, eh, ehm, hm, euh ...) onderstreept met brons; één klik verwijdert ze. Optioneel ook "dus", "eigenlijk", "zeg maar". Let op: Whisper laat korte "eh"/"uhm" vaak al weg uit de output; dan zijn er niets te markeren.
4. **Stiltes inkorten**: gaten tussen woorden > 0,7 s worden teruggebracht tot 0,25 s.
5. **Zoeken**: deelwoord of frase, treffers gemarkeerd en selecteerbaar.

## Ripple-delete
`TranscriptCutCommand` (`services/transcript/ripple-cut.ts`) knipt de bereiken uit álle tracks (beeld, audio, overlays blijven synchroon), splitst clips en schuift het vervolg op. Het is één command via `editor.command.execute`, dus één undo/redo-stap (Cmd/Ctrl+Z); het transcript in de store wordt bij undo/redo mee teruggezet. Pure logica: `ripple-cut-core.ts` en `words.ts` (unit-tests in `services/transcript/__tests__`, `bun test src/services/transcript`).

## Beperkingen
- Keyframe-animaties van geknipte clips worden niet opnieuw verdeeld (clip behoudt dezelfde animations).
- Transcript wordt niet bewaard bij herladen.
- Muted tracks tellen niet mee in de transcriptie.
