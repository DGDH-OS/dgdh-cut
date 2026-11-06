import type { TimelineElement } from "@/timeline/types";
import { generateUUID } from "@/utils/id";
import type { TimeRange } from "./types";
import { mergeRanges } from "./words";

/** Ticks per seconde (spiegelt rust/crates/time MediaTime). */
export const TRANSCRIPT_TICKS_PER_SECOND = 120_000;

/** Bronduur bij een duur op de clip (rate 1 als er geen retime is). */
export type SourceSpanFn = (args: {
	clipTicks: number;
	element: TimelineElement;
}) => number;

const identitySpan: SourceSpanFn = ({ clipTicks }) => clipTicks;

export type TickRange = { start: number; end: number };

export function toTickRanges(ranges: TimeRange[]): TickRange[] {
	return mergeRanges({ ranges }).map((r) => ({
		start: Math.round(r.start * TRANSCRIPT_TICKS_PER_SECOND),
		end: Math.round(r.end * TRANSCRIPT_TICKS_PER_SECOND),
	}));
}

function removedTicksBefore(ranges: TickRange[], time: number): number {
	let removed = 0;
	for (const r of ranges) {
		if (r.start >= time) break;
		removed += Math.min(r.end, time) - r.start;
	}
	return removed;
}

/**
 * Knip de gegeven tijdbereiken uit álle tracks en schuif wat erna komt op
 * (ripple-delete over de hele tijdlijn, zodat beeld, geluid en overlays
 * synchroon blijven). Pure functie, geen editor nodig.
 */
export function cutRangesFromElements<TElement extends TimelineElement>({
	elements,
	ranges,
	sourceSpanFn = identitySpan,
}: {
	elements: TElement[];
	ranges: TickRange[];
	sourceSpanFn?: SourceSpanFn;
}): TElement[] {
	if (ranges.length === 0) return elements;
	const result: TElement[] = [];

	for (const element of elements) {
		const start: number = element.startTime;
		const end: number = element.startTime + element.duration;

		// Kept intervals = [start, end) min alle ranges.
		const kept: TickRange[] = [];
		let cursor: number = start;
		for (const r of ranges) {
			if (r.end <= cursor) continue;
			if (r.start >= end) break;
			if (r.start > cursor) kept.push({ start: cursor, end: r.start });
			cursor = Math.max(cursor, r.end);
		}
		if (cursor < end) kept.push({ start: cursor, end });

		const untouched =
			kept.length === 1 && kept[0].start === start && kept[0].end === end;
		if (untouched) {
			const shift = removedTicksBefore(ranges, start);
			result.push(
				shift === 0
					? element
					: ({
							...element,
							startTime: (start - shift) as TElement["startTime"],
						} as TElement),
			);
			continue;
		}

		const sourceSpan = (clipTicks: number): number =>
			Math.round(sourceSpanFn({ clipTicks, element }));
		const totalSource = sourceSpan(element.duration);

		kept.forEach((piece, index) => {
			const offset = piece.start - start;
			const duration = piece.end - piece.start;
			const leadSource = sourceSpan(offset);
			const tailSource = totalSource - sourceSpan(offset + duration);
			result.push({
				...element,
				id: index === 0 ? element.id : generateUUID(),
				startTime: (piece.start - removedTicksBefore(ranges, piece.start)) as TElement["startTime"],
				duration: duration as TElement["duration"],
				trimStart: ((element.trimStart as number) + leadSource) as TElement["trimStart"],
				trimEnd: ((element.trimEnd as number) + tailSource) as TElement["trimEnd"],
			} as TElement);
		});
	}
	return result;
}

