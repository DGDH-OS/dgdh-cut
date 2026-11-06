import type { TimeRange, TranscriptWord } from "./types";

const FILLERS_CORE = new Set([
	"uh",
	"uhm",
	"uhh",
	"uhhm",
	"eh",
	"ehm",
	"ehh",
	"ehhm",
	"euh",
	"euhm",
	"hm",
	"hmm",
	"um",
	"umm",
	"mm",
	"mmm",
	"erm",
	"ah",
	"ahm",
]);
/** Optionele "stopwoorden" die alleen op verzoek als filler tellen. */
export const OPTIONAL_FILLERS = new Set(["dus", "zeg maar", "eigenlijk"]);

export function normalizeWord(text: string): string {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]/g, "");
}

export function isFillerWord({
	text,
	includeOptional = false,
}: {
	text: string;
	includeOptional?: boolean;
}): boolean {
	const word = normalizeWord(text);
	if (!word) return false;
	if (FILLERS_CORE.has(word)) return true;
	return includeOptional && OPTIONAL_FILLERS.has(word);
}

export function findFillerWords({
	words,
	includeOptional = false,
}: {
	words: TranscriptWord[];
	includeOptional?: boolean;
}): TranscriptWord[] {
	return words.filter((w) => isFillerWord({ text: w.text, includeOptional }));
}

/** Zet ruwe Whisper-chunks (woord-niveau) om naar woorden met id. */
export function buildWords({
	chunks,
}: {
	chunks: { text: string; start: number; end: number }[];
}): TranscriptWord[] {
	const words: TranscriptWord[] = [];
	for (const chunk of chunks) {
		const text = chunk.text.trim();
		if (!text) continue;
		const start = Math.max(0, chunk.start);
		const end = Math.max(start, chunk.end);
		words.push({ id: `w${words.length}`, text, start, end });
	}
	// Whisper laat het laatste woord soms zonder einde: sluit tegen volgende woord aan.
	for (let i = 0; i < words.length - 1; i++) {
		if (words[i].end <= words[i].start) {
			words[i].end = Math.min(words[i + 1].start, words[i].start + 0.3);
		}
	}
	return words;
}

/** Sorteer en voeg overlappende of aansluitende bereiken samen. */
export function mergeRanges({
	ranges,
	epsilon = 1e-6,
}: {
	ranges: TimeRange[];
	epsilon?: number;
}): TimeRange[] {
	const sorted = ranges
		.filter((r) => r.end - r.start > epsilon)
		.map((r) => ({ ...r }))
		.sort((a, b) => a.start - b.start);
	const merged: TimeRange[] = [];
	for (const range of sorted) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end + epsilon) {
			last.end = Math.max(last.end, range.end);
		} else {
			merged.push(range);
		}
	}
	return merged;
}

/**
 * Tijdbereiken die bij geselecteerde woorden horen. Een woord wordt van het
 * einde van het vorige woord tot het begin van het volgende "opgegeten" tot
 * maximaal `pad` seconden, zodat er geen losse stukjes ademhaling blijven staan.
 */
export function wordsToRanges({
	words,
	selectedIds,
	pad = 0.04,
}: {
	words: TranscriptWord[];
	selectedIds: Set<string>;
	pad?: number;
}): TimeRange[] {
	const ranges: TimeRange[] = [];
	for (let i = 0; i < words.length; i++) {
		if (!selectedIds.has(words[i].id)) continue;
		const prevEnd = i > 0 ? words[i - 1].end : 0;
		const nextStart = i < words.length - 1 ? words[i + 1].start : words[i].end + pad;
		const start = Math.max(prevEnd, words[i].start - pad);
		const end = Math.min(nextStart, words[i].end + pad);
		ranges.push({ start, end: Math.max(end, words[i].end) });
	}
	return mergeRanges({ ranges });
}

/**
 * Stiltes langer dan `minSilence` worden ingekort tot `keep` seconden.
 * Retourneert de bereiken die verwijderd moeten worden.
 */
export function silenceRanges({
	words,
	minSilence = 0.7,
	keep = 0.25,
}: {
	words: TranscriptWord[];
	minSilence?: number;
	keep?: number;
}): TimeRange[] {
	const ranges: TimeRange[] = [];
	for (let i = 0; i < words.length - 1; i++) {
		const gapStart = words[i].end;
		const gapEnd = words[i + 1].start;
		const gap = gapEnd - gapStart;
		if (gap < minSilence || gap <= keep) continue;
		const half = keep / 2;
		ranges.push({ start: gapStart + half, end: gapEnd - half });
	}
	return mergeRanges({ ranges });
}

export function rangesDuration(ranges: TimeRange[]): number {
	return ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
}

/** Totaal verwijderde tijd vóór `time`. */
export function removedBefore({
	ranges,
	time,
}: {
	ranges: TimeRange[];
	time: number;
}): number {
	let removed = 0;
	for (const r of ranges) {
		if (r.start >= time) break;
		removed += Math.min(r.end, time) - r.start;
	}
	return removed;
}

/**
 * Pas woordtijden aan na ripple-delete. Woorden die (grotendeels) in een
 * verwijderd bereik vallen verdwijnen, de rest schuift op.
 */
export function remapWords({
	words,
	ranges,
}: {
	words: TranscriptWord[];
	ranges: TimeRange[];
}): TranscriptWord[] {
	const merged = mergeRanges({ ranges });
	const result: TranscriptWord[] = [];
	for (const word of words) {
		const mid = (word.start + word.end) / 2;
		if (merged.some((r) => mid >= r.start && mid < r.end)) continue;
		const shiftStart = removedBefore({ ranges: merged, time: word.start });
		const shiftEnd = removedBefore({ ranges: merged, time: word.end });
		const start = word.start - shiftStart;
		result.push({
			...word,
			start,
			end: Math.max(start, word.end - shiftEnd),
		});
	}
	return result;
}

export function searchWords({
	words,
	query,
}: {
	words: TranscriptWord[];
	query: string;
}): string[] {
	const terms = query
		.split(/\s+/)
		.map(normalizeWord)
		.filter(Boolean);
	if (terms.length === 0) return [];
	const normalized = words.map((w) => normalizeWord(w.text));
	const hits: string[] = [];
	for (let i = 0; i + terms.length <= words.length; i++) {
		const matches = terms.every((term, j) =>
			j === terms.length - 1
				? normalized[i + j].includes(term)
				: normalized[i + j] === term,
		);
		if (matches) {
			for (let j = 0; j < terms.length; j++) hits.push(words[i + j].id);
		}
	}
	return hits;
}
