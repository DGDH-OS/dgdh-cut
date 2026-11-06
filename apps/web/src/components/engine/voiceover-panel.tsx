"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { engineFetch, enginePostJson, engineUrl } from "@/components/engine/engine-client";

interface MediaItem {
	file: string;
	url: string;
	kind: "image" | "video";
	bytes: number;
	duration_s?: number | null;
}

interface VoiceoverResult {
	ok?: boolean;
	error?: string;
	id?: string;
	voice?: string;
	voice_bytes?: number;
	duration_s?: number;
	words?: { word?: string; text?: string; from_ms?: number; to_ms?: number }[];
	preview?: string;
	bytes?: number;
}

export function VoiceoverPanel() {
	const [text, setText] = useState("");
	const [voiceId, setVoiceId] = useState("");
	const [model, setModel] = useState("");

	const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
	const [targetFile, setTargetFile] = useState("");

	const [generating, setGenerating] = useState(false);
	const [result, setResult] = useState<VoiceoverResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const media = await engineFetch<{ ok: boolean; items: MediaItem[] }>(
					"api/media-bin",
				);
				if (cancelled) return;
				setMediaItems((media.items ?? []).filter((i) => i.kind === "video"));
			} catch {
				// media-bin is optioneel; voice-over werkt ook zonder doelvideo.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const generate = async () => {
		setGenerating(true);
		setResult(null);
		setError(null);
		try {
			const res = await enginePostJson<VoiceoverResult>("api/voiceover", {
				text: text.trim(),
				...(voiceId.trim() ? { voice_id: voiceId.trim() } : {}),
				...(model.trim() ? { model: model.trim() } : {}),
				...(targetFile ? { file: targetFile } : {}),
			});
			setResult(res);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Voice-over mislukt");
		} finally {
			setGenerating(false);
		}
	};

	const wordCount = result?.words?.length ?? 0;
	const captionText = (result?.words ?? [])
		.map((w) => w.word ?? w.text ?? "")
		.filter(Boolean)
		.join(" ");

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<div className="flex flex-col gap-2">
				<label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
					Voice-over tekst
				</label>
				<Textarea
					placeholder="Typ de voice-over tekst..."
					value={text}
					onChange={({ currentTarget }) => setText(currentTarget.value)}
					className="min-h-[120px]"
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
					Stem (optioneel, voice_id)
				</label>
				<Input
					placeholder="EXAVITQu4vr4xnSDxMaL (Sarah, standaard)"
					value={voiceId}
					onChange={({ currentTarget }) => setVoiceId(currentTarget.value)}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
					Model (optioneel)
				</label>
				<Input
					placeholder="eleven_multilingual_v2 (standaard)"
					value={model}
					onChange={({ currentTarget }) => setModel(currentTarget.value)}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<label className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
					Doelvideo (optioneel, mux + karaoke-captions)
				</label>
				<Select
					value={targetFile}
					onValueChange={(v) => setTargetFile(v === "none" ? "" : v)}
				>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Geen (alleen audio)" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Geen (alleen audio)</SelectItem>
						{mediaItems.map((m) => (
							<SelectItem key={m.file} value={m.file}>
								{m.file}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Button onClick={generate} disabled={generating || !text.trim()}>
				{generating ? "Genereren..." : "Genereer voice-over"}
			</Button>

			{error && <div className="text-destructive text-sm">Error: {error}</div>}

			{result?.voice && (
				<div className="border-border flex flex-col gap-2 rounded-md border p-3">
					<p className="text-sm font-medium">
						Voice-over gegenereerd
						{result.duration_s != null ? ` · ${result.duration_s}s` : ""}
						{wordCount > 0 ? ` · ${wordCount} woorden` : ""}
					</p>
					<audio
						src={engineUrl(result.voice)}
						controls
						className="w-full"
					/>
					{captionText && (
						<p className="text-muted-foreground text-xs">
							{captionText.slice(0, 240)}
							{captionText.length > 240 ? "..." : ""}
						</p>
					)}
					{result.preview && (
						<video
							src={engineUrl(result.preview)}
							controls
							className="max-h-40 w-full rounded-sm bg-background"
						/>
					)}
				</div>
			)}
		</div>
	);
}
