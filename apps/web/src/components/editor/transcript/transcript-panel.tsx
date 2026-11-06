"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useEditor } from "@/editor/use-editor";
import { extractTimelineAudio } from "@/media/mediabunny";
import { decodeAudioToFloat32 } from "@/media/audio";
import { DEFAULT_TRANSCRIPTION_SAMPLE_RATE } from "@/transcription/audio";
import { transcribeWords } from "@/services/transcript/service";
import { useTranscriptStore } from "@/services/transcript/store";
import { TranscriptCutCommand } from "@/services/transcript/ripple-cut";
import {
	TRANSCRIPT_LANGUAGES,
	type TranscriptLanguage,
} from "@/services/transcript/types";
import {
	findFillerWords,
	rangesDuration,
	searchWords,
	silenceRanges,
	wordsToRanges,
} from "@/services/transcript/words";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import { cn } from "@/utils/ui";

const MIN_SILENCE_SECONDS = 0.7;
const KEEP_SILENCE_SECONDS = 0.25;

function formatSeconds(seconds: number): string {
	return `${seconds.toFixed(1)} s`;
}

export function TranscriptPanel() {
	const editor = useEditor();
	const words = useTranscriptStore((s) => s.words);
	const language = useTranscriptStore((s) => s.language);
	const selectedIds = useTranscriptStore((s) => s.selectedIds);
	const setWords = useTranscriptStore((s) => s.setWords);
	const setLanguage = useTranscriptStore((s) => s.setLanguage);
	const setSelection = useTranscriptStore((s) => s.setSelection);

	const [busyStep, setBusyStep] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [includeOptional, setIncludeOptional] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const anchorRef = useRef<number | null>(null);

	useEffect(() => {
		const timer = window.setInterval(() => {
			setCurrentTime(mediaTimeToSeconds({ time: editor.playback.getCurrentTime() }));
		}, 100);
		return () => window.clearInterval(timer);
	}, [editor]);

	const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
	const fillers = useMemo(
		() => findFillerWords({ words, includeOptional }),
		[words, includeOptional],
	);
	const fillerIds = useMemo(() => new Set(fillers.map((w) => w.id)), [fillers]);
	const silences = useMemo(
		() =>
			silenceRanges({
				words,
				minSilence: MIN_SILENCE_SECONDS,
				keep: KEEP_SILENCE_SECONDS,
			}),
		[words],
	);
	const hits = useMemo(() => new Set(searchWords({ words, query })), [words, query]);
	const currentWordId = words.find(
		(w) => currentTime >= w.start && currentTime < w.end,
	)?.id;

	const run = (ranges: { start: number; end: number }[]) => {
		if (ranges.length === 0) return;
		editor.command.execute({ command: new TranscriptCutCommand(ranges) });
	};

	const handleTranscribe = async () => {
		setError(null);
		try {
			setBusyStep("Audio extraheren...");
			const audioBlob = await extractTimelineAudio({
				tracks: editor.scenes.getActiveScene().tracks,
				mediaAssets: editor.media.getAssets(),
				totalDuration: editor.timeline.getTotalDuration(),
			});
			setBusyStep("Audio voorbereiden...");
			const { samples } = await decodeAudioToFloat32({
				audioBlob,
				sampleRate: DEFAULT_TRANSCRIPTION_SAMPLE_RATE,
			});
			const result = await transcribeWords({
				audioData: samples,
				language,
				onProgress: (p) =>
					setBusyStep(
						p.status === "loading-model"
							? `Model laden ${Math.round(p.progress)}%`
							: "Transcriberen...",
					),
			});
			if (result.length === 0) {
				setError("Er is geen spraak gevonden in de tijdlijn.");
			}
			setWords({ words: result });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Transcriptie mislukt");
		} finally {
			setBusyStep(null);
		}
	};

	const handleWordClick = ({
		index,
		shiftKey,
	}: {
		index: number;
		shiftKey: boolean;
	}) => {
		const word = words[index];
		editor.playback.seek({ time: mediaTimeFromSeconds({ seconds: word.start }) });
		if (shiftKey && anchorRef.current !== null) {
			const [from, to] = [anchorRef.current, index].sort((a, b) => a - b);
			setSelection({ ids: words.slice(from, to + 1).map((w) => w.id) });
			return;
		}
		anchorRef.current = index;
		setSelection({ ids: [word.id] });
	};

	const deleteSelection = () => {
		run(wordsToRanges({ words, selectedIds: selected }));
	};

	const silenceSaving = rangesDuration(silences);
	const isBusy = busyStep !== null;

	return (
		<PanelView title="Transcript" contentClassName="gap-3 p-3">
			<div className="flex flex-col gap-3" data-testid="transcript-panel">
				<div className="flex items-center gap-2">
					<Select
						value={language}
						onValueChange={(value) =>
							setLanguage({ language: value as TranscriptLanguage })
						}
					>
						<SelectTrigger aria-label="Taal" className="max-md:min-h-11">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{TRANSCRIPT_LANGUAGES.map((l) => (
								<SelectItem key={l.code} value={l.code}>
									{l.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						onClick={handleTranscribe}
						disabled={isBusy}
						data-testid="transcript-generate"
						className="shrink-0"
					>
						{isBusy && <Spinner className="mr-1" />}
						{isBusy ? busyStep : words.length ? "Opnieuw" : "Transcriberen"}
					</Button>
				</div>

				{error && (
					<p role="alert" className="text-destructive text-sm">
						Fout: {error}
					</p>
				)}

				{words.length === 0 && !isBusy && !error && (
					<p className="text-muted-foreground text-sm">
						Transcribeer de spraak op de tijdlijn. Klik daarna op een woord om
						erheen te springen, selecteer woorden en verwijder ze met ripple.
					</p>
				)}

				{words.length > 0 && (
					<>
						<Input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Zoeken in transcript"
							aria-label="Zoeken in transcript"
							className="max-md:min-h-11"
						/>
						{query && (
							<div className="flex items-center justify-between gap-2">
								<span className="text-muted-foreground text-sm" data-testid="transcript-hits">
									{hits.size} {hits.size === 1 ? "treffer" : "treffers"}
								</span>
								{hits.size > 0 && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setSelection({ ids: [...hits] })}
									>
										Selecteer treffers
									</Button>
								)}
							</div>
						)}

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="destructive"
								size="sm"
								disabled={selected.size === 0}
								onClick={deleteSelection}
								data-testid="transcript-delete"
							>
								Verwijder selectie ({selected.size})
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={fillers.length === 0}
								onClick={() =>
									run(
										wordsToRanges({
											words,
											selectedIds: fillerIds,
										}),
									)
								}
								data-testid="transcript-fillers"
							>
								Vulwoorden verwijderen ({fillers.length})
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={silences.length === 0}
								onClick={() => run(silences)}
								data-testid="transcript-silences"
							>
								Stiltes inkorten ({silences.length}
								{silences.length > 0 ? `, ${formatSeconds(silenceSaving)}` : ""})
							</Button>
						</div>
						<label className="text-muted-foreground flex min-h-11 items-center gap-2 text-sm md:min-h-0">
							<input
								type="checkbox"
								checked={includeOptional}
								onChange={(e) => setIncludeOptional(e.target.checked)}
								className="size-4"
							/>
							Ook &quot;dus&quot;, &quot;eigenlijk&quot; en &quot;zeg maar&quot; markeren
						</label>

						<div
							className="flex flex-wrap gap-x-0.5 gap-y-0.5 text-sm leading-relaxed"
							data-testid="transcript-words"
							onKeyDown={(e) => {
								if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
									e.preventDefault();
									deleteSelection();
								}
							}}
						>
							{words.map((word, index) => {
								const isSelected = selected.has(word.id);
								const isFiller = fillerIds.has(word.id);
								const isHit = hits.has(word.id);
								return (
									<button
										key={word.id}
										type="button"
										data-word-id={word.id}
										aria-pressed={isSelected}
										title={isFiller ? "Vulwoord" : undefined}
										onClick={(e) => handleWordClick({ index, shiftKey: e.shiftKey })}
										className={cn(
											"rounded-sm px-1 text-left max-md:min-h-11 max-md:px-1.5",
											"hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-1",
											isFiller && "underline decoration-bronze decoration-2 underline-offset-4",
											isHit && "bg-bronze/25",
											word.id === currentWordId && "bg-brand text-primary-foreground",
											isSelected && "bg-accent ring-1 ring-bronze",
										)}
									>
										{word.text}
									</button>
								);
							})}
						</div>
					</>
				)}
			</div>
		</PanelView>
	);
}
