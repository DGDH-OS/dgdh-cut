import { describe, expect, test } from "bun:test";
import {
	INTERCHANGE_FORMATS,
	RATE_25,
	RATE_2997,
	buildInterchangeTimeline,
	parseInterchange,
	serializeInterchange,
	sortClips,
	type InterchangeClip,
	type InterchangeFormat,
	type InterchangeTimeline,
} from "../index";
import {
	autoMatchMedia,
	buildProjectFromInterchange as build,
	type ImportDeps,
	detectInterchangeFormat,
	listMediaRefs,
	type ImportMedia,
} from "../import-project";
import type { Rate } from "../timecode";

const clip = (
	over: Partial<InterchangeClip> & Pick<InterchangeClip, "id" | "recordIn" | "duration">,
): InterchangeClip => ({
	name: `Clip ${over.id}`,
	kind: "video",
	track: 0,
	media: "interview-a.mp4",
	sourceIn: 0,
	speed: 1,
	...over,
});

function sample(rate: Rate, dropFrame = false): InterchangeTimeline {
	const base = Math.round(rate.num / rate.den);
	return {
		name: "Importtest",
		rate,
		width: 1920,
		height: 1080,
		startFrame: 3600 * base,
		dropFrame,
		clips: [
			clip({ id: "a", recordIn: 0, duration: base * 5, sourceIn: base * 2 }),
			clip({ id: "b", recordIn: base * 5, duration: base * 3, media: "b-roll.mov", sourceIn: 40 }),
			clip({ id: "c", recordIn: base * 10, duration: base * 4, media: "b-roll.mov", sourceIn: 400 }),
			clip({ id: "d", recordIn: base * 11, duration: base * 2, track: 1, media: "overlay.png" }),
			clip({ id: "e", recordIn: 0, duration: base * 14, kind: "audio", media: "muziek.wav" }),
		],
	};
}

const TICKS_PER_SECOND = 120000;
const deps: ImportDeps = {
	version: 1,
	backgroundColor: "#000000",
	buildScene: () => ({
		id: "scene",
		name: "Hoofdscène",
		isMain: true,
		tracks: {
			overlay: [],
			audio: [],
			main: { id: "main", name: "Main", type: "video", elements: [], muted: false, hidden: false },
		},
		bookmarks: [],
		createdAt: new Date(0),
		updatedAt: new Date(0),
	}),
	buildElement: ({ mediaId, mediaType, name, duration, startTime }) => ({
		type: mediaType,
		mediaId,
		name,
		duration,
		startTime,
	}),
};
const buildProjectFromInterchange = (a: Omit<Parameters<typeof build>[0], "deps">) => build({ ...a, deps });

const MEDIA: Record<string, ImportMedia> = {
	"interview-a.mp4": { id: "m1", type: "video", durationSeconds: 60 },
	"b-roll.mov": { id: "m2", type: "video", durationSeconds: 120 },
	"overlay.png": { id: "m3", type: "image" },
	"muziek.wav": { id: "m4", type: "audio", durationSeconds: 200 },
};
const assets = Object.entries(MEDIA).map(([name, m]) => ({ id: m.id, name }));

const key = (c: InterchangeClip) =>
	[c.kind, c.track, c.recordIn, c.duration, c.sourceIn, c.media, c.speed].join("|");
const keys = (t: InterchangeTimeline) => sortClips(t.clips).map(key).sort();

function importExport(format: InterchangeFormat, rate: Rate, text: string) {
	const parsed = parseInterchange(format, text, rate);
	const { project, skipped } = buildProjectFromInterchange({
		timeline: parsed,
		media: MEDIA,
		ticksPerSecond: TICKS_PER_SECOND,
	});
	expect(skipped).toEqual([]);
	const back = buildInterchangeTimeline({
		project,
		assets,
		ticksPerSecond: TICKS_PER_SECOND,
	});
	return { project, back, text: serializeInterchange(format, back) };
}

describe.each(INTERCHANGE_FORMATS.flatMap((f) => [
	[f, "25", RATE_25, false],
	[f, "29.97 DF", RATE_2997, true],
] as const))("export -> import -> export (%s, %s)", (format, _l, rate, df) => {
	test("clips en tekst blijven gelijk", () => {
		const source = sample(rate, df);
		const first = serializeInterchange(format, source);
		const { project, back, text } = importExport(format, rate, first);
		expect(keys(back)).toEqual(keys(source));
		expect(project.settings.fps).toEqual({ numerator: rate.num, denominator: rate.den });
		expect(project.scenes[0].tracks.overlay.length).toBe(1);
		expect(project.scenes[0].tracks.audio.length).toBe(1);
		// tweede ronde: de geëxporteerde tekst is stabiel
		const second = importExport(format, rate, text);
		expect(second.text).toBe(text);
	});
});

test("snelheid blijft behouden", () => {
	const t = sample(RATE_25);
	t.clips[0] = { ...t.clips[0], speed: 2 };
	for (const format of ["otio", "fcpxml"] as const) {
		const { back } = importExport(format, RATE_25, serializeInterchange(format, t));
		expect(back.clips.find((c) => c.media === "interview-a.mp4")?.speed).toBe(2);
	}
});

test("niet-gekoppelde media wordt overgeslagen", () => {
	const t = sample(RATE_25);
	const { skipped, placed } = buildProjectFromInterchange({
		timeline: t,
		media: { ...MEDIA, "b-roll.mov": undefined },
		ticksPerSecond: TICKS_PER_SECOND,
	});
	expect(skipped.length).toBe(2);
	expect(placed).toBe(3);
});

describe("auto-match", () => {
	test("exact, stem en EDL-reel", () => {
		const m = autoMatchMedia({
			refs: ["interview-a.mp4", "b-roll.mov", "INTERVIEW", "ZZ"],
			fileNames: ["interview-a.mp4", "B-Roll.MOV", "interview-b-lang.mp4"],
		});
		expect(m["interview-a.mp4"]).toEqual({ fileIndex: 0, method: "naam" });
		expect(m["b-roll.mov"]).toEqual({ fileIndex: 1, method: "bestandsnaam" });
		expect(m.INTERVIEW).toEqual({ fileIndex: 2, method: "reel" });
		expect(m.ZZ).toBeUndefined();
	});
	test("reel koppelt niet bij meerdere kandidaten", () => {
		const m = autoMatchMedia({ refs: ["INTERVIE"], fileNames: ["interview-a.mp4", "interview-b.mp4"] });
		expect(m.INTERVIE).toBeUndefined();
	});
});

test("formatdetectie en mediaverwijzingen", () => {
	const t = sample(RATE_25);
	expect(detectInterchangeFormat({ fileName: "x.EDL", text: "" })).toBe("edl");
	expect(detectInterchangeFormat({ fileName: "x.txt", text: serializeInterchange("otio", t) })).toBe("otio");
	expect(detectInterchangeFormat({ fileName: "x.xml", text: serializeInterchange("fcpxml", t) })).toBe("fcpxml");
	expect(listMediaRefs(t).map((r) => [r.name, r.clips])).toEqual([
		["interview-a.mp4", 1],
		["b-roll.mov", 2],
		["overlay.png", 1],
		["muziek.wav", 1],
	]);
});
