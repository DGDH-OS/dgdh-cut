"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { engineFetch, enginePostJson, engineUrl } from "@/components/engine/engine-client";

interface SfxSound {
	file: string;
	category: string;
	duration_s?: number;
	name?: string;
	source?: string;
	license?: string;
	license_status?: string;
	trending?: boolean;
	age_days?: number | null;
	url: string;
	gain_db?: number | null;
	[k: string]: unknown;
}

interface SfxLibrary {
	ok: boolean;
	categories: string[];
	count: number;
	sounds: SfxSound[];
}

interface MediaItem {
	file: string;
	url: string;
	kind: "image" | "video";
	bytes: number;
	duration_s?: number | null;
}

interface SfxMixResult {
	ok?: boolean;
	error?: string;
	id?: string;
	preview?: string;
	bytes?: number;
	cues_used?: number;
	cues?: { t: number; category: string; gain_db: number; file: string }[];
	duration_s?: number;
}

function displayName(s: SfxSound): string {
	if (s.name) return s.name;
	const base = s.file.split("/").pop() ?? s.file;
	return base
		.replace(/\.(wav|mp3|ogg|flac)$/i, "")
		.replace(/[_-]+/g, " ")
		.trim();
}

export function DgdhSfxView() {
	const [lib, setLib] = useState<SfxLibrary | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("all");

	const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
	const [targetFile, setTargetFile] = useState("");
	const [mixTime, setMixTime] = useState("0");

	const [playingUrl, setPlayingUrl] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const [applying, setApplying] = useState(false);
	const [result, setResult] = useState<SfxMixResult | null>(null);
	const [resultError, setResultError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const [library, media] = await Promise.all([
					engineFetch<SfxLibrary>("api/sfx-library"),
					engineFetch<{ ok: boolean; items: MediaItem[] }>("api/media-bin"),
				]);
				if (cancelled) return;
				setLib(library);
				const videos = (media.items ?? []).filter((i) => i.kind === "video");
				setMediaItems(videos);
				if (videos.length > 0) setTargetFile(videos[0].file);
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "SFX-bibliotheek laden mislukt");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		return () => {
			audioRef.current?.pause();
		};
	}, []);

	const togglePreview = (sound: SfxSound) => {
		const url = engineUrl(sound.url);
		if (playingUrl === url) {
			audioRef.current?.pause();
			setPlayingUrl(null);
			return;
		}
		audioRef.current?.pause();
		const audio = new Audio(url);
		audio.addEventListener("ended", () => setPlayingUrl(null));
		audio.addEventListener("error", () => setPlayingUrl(null));
		audio.play().catch(() => setPlayingUrl(null));
		audioRef.current = audio;
		setPlayingUrl(url);
	};

	const applySfx = async (sound: SfxSound) => {
		if (!targetFile) {
			setResultError("Kies eerst een doelvideo (media-bin).");
			return;
		}
		setApplying(true);
		setResult(null);
		setResultError(null);
		try {
			const t = Number(mixTime);
			const res = await enginePostJson<SfxMixResult>("api/sfx-mix", {
				file: targetFile,
				cues: [{ t: Number.isFinite(t) ? t : 0, category: sound.category }],
			});
			setResult(res);
		} catch (e) {
			setResultError(e instanceof Error ? e.message : "SFX mixen mislukt");
		} finally {
			setApplying(false);
		}
	};

	const autoMix = async () => {
		if (!targetFile) {
			setResultError("Kies eerst een doelvideo (media-bin).");
			return;
		}
		setApplying(true);
		setResult(null);
		setResultError(null);
		try {
			const res = await enginePostJson<SfxMixResult>("api/sfx-mix", {
				file: targetFile,
				auto: true,
			});
			setResult(res);
		} catch (e) {
			setResultError(e instanceof Error ? e.message : "SFX mixen mislukt");
		} finally {
			setApplying(false);
		}
	};

	const sounds = (lib?.sounds ?? []).filter((s) => {
		if (category !== "all" && s.category !== category) return false;
		const q = query.trim().toLowerCase();
		if (!q) return true;
		const hay = [s.name, s.category, s.source, displayName(s)]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();
		return hay.includes(q);
	});

	return (
		<div className="flex h-full flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<Input
						placeholder="Zoek SFX (naam, categorie...)"
						className="w-full"
						containerClassName="w-full"
						value={query}
						onChange={({ currentTarget }) => setQuery(currentTarget.value)}
						showClearIcon
						onClear={() => setQuery("")}
					/>
					<Select value={category} onValueChange={setCategory}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Categorie" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Alle categorieën</SelectItem>
							{(lib?.categories ?? []).map((c) => (
								<SelectItem key={c} value={c}>
									{c}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-3">
					<Select value={targetFile} onValueChange={setTargetFile}>
						<SelectTrigger className="w-56">
							<SelectValue placeholder="Doelvideo (media-bin)" />
						</SelectTrigger>
						<SelectContent>
							{mediaItems.map((m) => (
								<SelectItem key={m.file} value={m.file}>
									{m.file}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						type="number"
						step="0.1"
						min="0"
						value={mixTime}
						onChange={({ currentTarget }) => setMixTime(currentTarget.value)}
						className="w-24"
						aria-label="Mix-tijd (seconden)"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={autoMix}
						disabled={applying || !targetFile}
					>
						Auto-mix
					</Button>
				</div>
			</div>

			{loading && (
				<div className="text-muted-foreground text-sm">SFX laden...</div>
			)}
			{error && <div className="text-destructive text-sm">Error: {error}</div>}
			{!loading && !error && sounds.length === 0 && (
				<div className="text-muted-foreground text-sm">Geen SFX gevonden</div>
			)}

			{resultError && (
				<div className="text-destructive text-sm">Error: {resultError}</div>
			)}

			{result?.preview && (
				<div className="border-border flex flex-col gap-2 rounded-md border p-3">
					<p className="text-sm font-medium">
						Gemixt ({result.cues_used ?? 0} cue
						{result.cues_used === 1 ? "" : "s"}
						{result.duration_s ? `, ${result.duration_s}s` : ""})
					</p>
					<video
						src={engineUrl(result.preview)}
						controls
						className="max-h-40 w-full rounded-sm bg-background"
					/>
				</div>
			)}

			<div className="relative min-h-0 flex-1 overflow-hidden">
				<ScrollArea className="h-full">
					<div className="flex flex-col gap-1 pr-2">
						{sounds.map((sound) => {
							const isPlaying = playingUrl === engineUrl(sound.url);
							return (
								<div
									key={sound.url}
									className="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
								>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => togglePreview(sound)}
									>
										{isPlaying ? "Stop" : "Play"}
									</Button>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">
											{displayName(sound)}
										</p>
										<span className="text-muted-foreground block truncate text-xs">
											{sound.category}
											{sound.duration_s != null
												? ` · ${sound.duration_s}s`
												: ""}
											{sound.trending ? " · trending" : ""}
										</span>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => applySfx(sound)}
										disabled={applying || !targetFile}
									>
										Toepassen
									</Button>
								</div>
							);
						})}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
}
