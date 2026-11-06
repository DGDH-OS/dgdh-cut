import { describe, expect, test } from "bun:test";
import type { TimelineElement } from "@/timeline";
import {
	cutRangesFromElements,
	TRANSCRIPT_TICKS_PER_SECOND as T,
} from "../ripple-cut-core";
import type { TranscriptWord } from "../types";
import {
	buildWords,
	findFillerWords,
	mergeRanges,
	remapWords,
	searchWords,
	silenceRanges,
	wordsToRanges,
} from "../words";

const w = (id: string, text: string, start: number, end: number): TranscriptWord => ({
	id,
	text,
	start,
	end,
});
const WORDS = [
	w("a", "Hallo", 0, 0.5),
	w("b", "eh", 0.6, 0.9),
	w("c", "wereld", 1.0, 1.5),
	w("d", "dus", 3.0, 3.3),
	w("e", "klaar", 3.4, 3.9),
];

describe("words", () => {
	test("fillers: kern en optioneel", () => {
		expect(findFillerWords({ words: WORDS }).map((x) => x.id)).toEqual(["b"]);
		expect(
			findFillerWords({ words: WORDS, includeOptional: true }).map((x) => x.id),
		).toEqual(["b", "d"]);
		expect(findFillerWords({ words: [w("x", "Uhm,", 0, 1)] })).toHaveLength(1);
	});
	test("mergeRanges voegt overlap samen", () => {
		expect(
			mergeRanges({
				ranges: [
					{ start: 2, end: 3 },
					{ start: 0, end: 1 },
					{ start: 0.9, end: 1.5 },
				],
			}),
		).toEqual([
			{ start: 0, end: 1.5 },
			{ start: 2, end: 3 },
		]);
	});
	test("wordsToRanges blijft binnen buren", () => {
		const r = wordsToRanges({ words: WORDS, selectedIds: new Set(["b"]) });
		expect(r).toHaveLength(1);
		expect(r[0].start).toBeGreaterThanOrEqual(0.5);
		expect(r[0].end).toBeLessThanOrEqual(1.0);
		expect(r[0].start).toBeLessThanOrEqual(0.6);
		expect(r[0].end).toBeGreaterThanOrEqual(0.9);
	});
	test("silenceRanges kort stilte in tot keep", () => {
		const r = silenceRanges({ words: WORDS, minSilence: 0.7, keep: 0.25 });
		expect(r).toHaveLength(1);
		// gat 1.5 -> 3.0 (1.5s), blijft 0.25 over
		expect(r[0].end - r[0].start).toBeCloseTo(1.25, 6);
	});
	test("remapWords schuift op en verwijdert gewiste woorden", () => {
		const ranges = wordsToRanges({ words: WORDS, selectedIds: new Set(["b"]) });
		const out = remapWords({ words: WORDS, ranges });
		expect(out.map((x) => x.id)).toEqual(["a", "c", "d", "e"]);
		const removed = ranges[0].end - ranges[0].start;
		expect(out[1].start).toBeCloseTo(1.0 - removed, 6);
		expect(out[3].end).toBeCloseTo(3.9 - removed, 6);
	});
	test("zoeken: frase en deelwoord", () => {
		expect(searchWords({ words: WORDS, query: "hal" })).toEqual(["a"]);
		expect(searchWords({ words: WORDS, query: "eh wereld" })).toEqual(["b", "c"]);
		expect(searchWords({ words: WORDS, query: "" })).toEqual([]);
	});
	test("buildWords sluit woord zonder einde aan", () => {
		const out = buildWords({
			chunks: [
				{ text: " a", start: 0, end: 0 },
				{ text: " b", start: 0.2, end: 0.4 },
			],
		});
		expect(out[0].end).toBeCloseTo(0.2, 6);
	});
});

function el(id: string, start: number, dur: number): TimelineElement {
	return {
		id,
		type: "audio",
		sourceType: "library",
		sourceUrl: "x",
		name: id,
		startTime: start * T,
		duration: dur * T,
		trimStart: 0,
		trimEnd: 0,
		params: {},
	} as unknown as TimelineElement;
}

const cut2 = (a: { elements: TimelineElement[]; ranges: { start: number; end: number }[] }) =>
	cutRangesFromElements(a).map((e) => ({
		id: e.id,
		startTime: e.startTime as number,
		duration: e.duration as number,
		trimStart: e.trimStart as number,
		trimEnd: e.trimEnd as number,
	}));

describe("cutRangesFromElements", () => {
	const cut = [{ start: 2 * T, end: 3 * T }];
	test("midden uit clip -> twee stukken, totaal 1s korter", () => {
		const out = cut2({ elements: [el("a", 0, 10)], ranges: cut });
		expect(out).toHaveLength(2);
		expect(out[0].startTime).toBe(0);
		expect(out[0].duration).toBe(2 * T);
		expect(out[0].trimEnd).toBe(8 * T);
		expect(out[1].startTime).toBe(2 * T);
		expect(out[1].duration).toBe(7 * T);
		expect(out[1].trimStart).toBe(3 * T);
		expect(out[1].trimEnd).toBe(0);
		expect(out[0].id).not.toBe(out[1].id);
		const total = out.reduce((s, e) => s + e.duration, 0);
		expect(total).toBe(9 * T);
	});
	test("clip na het gat schuift op, clip ervoor niet", () => {
		const out = cut2({
			elements: [el("a", 0, 1), el("b", 5, 2)],
			ranges: cut,
		});
		expect(out[0].startTime).toBe(0);
		expect(out[1].startTime).toBe(4 * T);
	});
	test("clip volledig in gat verdwijnt", () => {
		const out = cut2({
			elements: [el("a", 2.2, 0.5)],
			ranges: cut,
		});
		expect(out).toHaveLength(0);
	});
	test("clip die in gat begint wordt voorgekort", () => {
		const out = cut2({ elements: [el("a", 1, 3)], ranges: cut });
		expect(out).toHaveLength(2);
		expect(out[1].startTime).toBe(2 * T);
		expect(out[1].duration).toBe(1 * T);
		expect(out[1].trimStart).toBe(2 * T);
	});
	test("geen ranges laat alles ongemoeid", () => {
		const e = [el("a", 0, 1)];
		expect(cutRangesFromElements({ elements: e, ranges: [] })).toBe(e);
	});
});
