import { Command, type CommandResult } from "@/commands/base-command";
import { EditorCore } from "@/core";
import type { SceneTracks, TimelineElement } from "@/timeline";
import { isRetimableElement } from "@/timeline";
import { getSourceSpanAtClipTime } from "@/retime";
import { generateUUID } from "@/utils/id";
import {
	addMediaTime,
	roundMediaTime,
	subMediaTime,
	TICKS_PER_SECOND,
	type MediaTime,
} from "@/wasm";
import type { TimeRange, TranscriptWord } from "./types";
import { remapWords } from "./words";
import {
	cutRangesFromElements,
	toTickRanges,
	type SourceSpanFn,
} from "./ripple-cut-core";
import { useTranscriptStore } from "./store";

export function cutRangesFromTracks({
	tracks,
	ranges,
}: {
	tracks: SceneTracks;
	ranges: TimeRange[];
}): SceneTracks {
	const tickRanges = toTickRanges(ranges);
	const sourceSpanFn: SourceSpanFn = ({ clipTicks, element }) =>
		getSourceSpanAtClipTime({
			clipTime: clipTicks,
			retime: isRetimableElement(element) ? element.retime : undefined,
		});
	const cutTrack = <T extends { elements: TimelineElement[] }>(track: T): T =>
		({
			...track,
			elements: cutRangesFromElements({
				elements: track.elements,
				ranges: tickRanges,
				sourceSpanFn,
			}),
		}) as T;
	return {
		overlay: tracks.overlay.map(cutTrack),
		main: cutTrack(tracks.main),
		audio: tracks.audio.map(cutTrack),
	};
}

/**
 * Ripple-delete van tijdbereiken als één undo-stap. Houdt het transcript in
 * de panel-store synchroon (ook bij undo/redo).
 */
export class TranscriptCutCommand extends Command {
	private before: SceneTracks | null = null;
	private wordsBefore: TranscriptWord[] = [];

	constructor(private readonly ranges: TimeRange[]) {
		super();
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.before = editor.scenes.getActiveScene().tracks;
		this.wordsBefore = useTranscriptStore.getState().words;
		const after = cutRangesFromTracks({
			tracks: this.before,
			ranges: this.ranges,
		});
		editor.timeline.updateTracks(after);
		useTranscriptStore.getState().setWords({
			words: remapWords({ words: this.wordsBefore, ranges: this.ranges }),
		});
		return {
			selection: {
				selectedElements: [],
				selectedKeyframes: [],
				keyframeSelectionAnchor: null,
				selectedMaskPoints: null,
			},
		};
	}

	undo(): void {
		if (!this.before) return;
		EditorCore.getInstance().timeline.updateTracks(this.before);
		useTranscriptStore.getState().setWords({ words: this.wordsBefore });
	}
}
