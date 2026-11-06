"use client";

import { useState } from "react";
import { useEditor } from "@/editor/use-editor";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/utils/ui";
import { VOLUME_DB_MAX, VOLUME_DB_MIN } from "@/timeline/audio-constants";
import type { AudioTrack } from "@/timeline/types";
import { useMixerStore } from "./mixer-store";

function trackVolumeDb(track: AudioTrack): number {
	if (track.elements.length === 0) return 0;
	const sum = track.elements.reduce((acc, el) => {
		const v = el.params.volume;
		return acc + (typeof v === "number" ? v : 0);
	}, 0);
	return sum / track.elements.length;
}

function formatDb(db: number): string {
	const rounded = Math.round(db * 10) / 10;
	return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)} dB`;
}

export function MixerPanel() {
	const editor = useEditor();
	const tracks = useEditor(
		(e) => e.scenes.getActiveSceneOrNull()?.tracks.audio,
	);
	const soloIds = useMixerStore((s) => s.soloIds);
	const soloActive = soloIds.length > 0;

	const applySolo = (trackId: string) => {
		const audio = tracks ?? [];
		const currentMuted = Object.fromEntries(
			audio.map((t) => [t.id, t.muted]),
		);
		const { soloIds: nextSolo, baseline } = useMixerStore
			.getState()
			.engageSolo({ trackId, currentMuted });
		for (const track of audio) {
			const desired =
				nextSolo.length > 0
					? !nextSolo.includes(track.id)
					: (baseline[track.id] ?? track.muted);
			if (desired !== track.muted) {
				editor.timeline.toggleTrackMute({ trackId: track.id });
			}
		}
	};

	const commitVolume = (track: AudioTrack, target: number) => {
		const delta = target - trackVolumeDb(track);
		const updates = track.elements.map((el) => {
			const current = typeof el.params.volume === "number" ? el.params.volume : 0;
			const next = Math.min(
				VOLUME_DB_MAX,
				Math.max(VOLUME_DB_MIN, current + delta),
			);
			return {
				trackId: track.id,
				elementId: el.id,
				patch: { params: { ...el.params, volume: next } },
			};
		});
		editor.timeline.updateElements({ updates });
	};

	return (
		<div
			className="panel bg-background flex h-full min-w-0 flex-col overflow-hidden rounded-sm border"
			data-testid="audio-mixer"
		>
			<div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
				<h2 className="text-foreground text-sm font-medium">Audio mixer</h2>
				<span className="text-foreground text-xs">
					{tracks?.length ?? 0} {tracks?.length === 1 ? "track" : "tracks"}
				</span>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto p-3">
				{!tracks || tracks.length === 0 ? (
					<p className="text-foreground text-sm">
						No audio tracks yet. Add a sound or voiceover from the Sounds tab
						and its channel appears here.
					</p>
				) : (
					<ul className="flex flex-col gap-3">
						{tracks.map((track) => (
							<ChannelStrip
								key={track.id}
								track={track}
								soloed={soloIds.includes(track.id)}
								soloActive={soloActive}
								onMute={() =>
									editor.timeline.toggleTrackMute({ trackId: track.id })
								}
								onSolo={() => applySolo(track.id)}
								onVolume={(db) => commitVolume(track, db)}
							/>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function ChannelStrip({
	track,
	soloed,
	soloActive,
	onMute,
	onSolo,
	onVolume,
}: {
	track: AudioTrack;
	soloed: boolean;
	soloActive: boolean;
	onMute: () => void;
	onSolo: () => void;
	onVolume: (db: number) => void;
}) {
	const stored = trackVolumeDb(track);
	const [dragValue, setDragValue] = useState<number | null>(null);
	const shown = dragValue ?? stored;
	const empty = track.elements.length === 0;

	return (
		<li
			className="flex flex-col gap-2 rounded-sm border p-2"
			data-testid="mixer-channel"
			data-track-id={track.id}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-foreground min-w-0 truncate text-sm font-medium">
					{track.name || "Audio track"}
				</span>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						aria-pressed={track.muted}
						aria-label={`Mute ${track.name || "audio track"}`}
						data-testid="mixer-mute"
						disabled={soloActive}
						title={soloActive ? "Clear solo to change mute" : "Mute"}
						onClick={onMute}
						className={cn(
							"h-7 w-7 cursor-pointer rounded-sm border text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed",
							track.muted
								? "bg-destructive text-destructive-foreground border-destructive"
								: "text-foreground hover:bg-accent disabled:opacity-60",
						)}
					>
						M
					</button>
					<button
						type="button"
						aria-pressed={soloed}
						aria-label={`Solo ${track.name || "audio track"}`}
						data-testid="mixer-solo"
						title="Solo"
						onClick={onSolo}
						className={cn(
							"h-7 w-7 cursor-pointer rounded-sm border text-xs font-semibold focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
							soloed
								? "bg-primary text-primary-foreground border-primary"
								: "text-foreground hover:bg-accent",
						)}
					>
						S
					</button>
				</div>
			</div>
			<div className="flex items-center gap-3">
				<Slider
					aria-label={`Volume ${track.name || "audio track"}`}
					data-testid="mixer-volume"
					min={VOLUME_DB_MIN}
					max={VOLUME_DB_MAX}
					step={0.5}
					disabled={empty}
					value={[shown]}
					onValueChange={([v]) => setDragValue(v ?? 0)}
					onValueCommit={([v]) => {
						onVolume(v ?? 0);
						setDragValue(null);
					}}
				/>
				<span
					className="text-foreground w-[4.5rem] shrink-0 text-right text-xs tabular-nums"
					data-testid="mixer-db"
				>
					{formatDb(shown)}
				</span>
			</div>
			{empty && (
				<span className="text-foreground text-xs">Empty track</span>
			)}
		</li>
	);
}
