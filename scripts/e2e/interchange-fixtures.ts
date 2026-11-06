#!/usr/bin/env bun
/**
 * Hulp voor import-roundtrip.py.
 *   bun interchange-fixtures.ts gen <dir>             -> sample.{edl,otio,fcpxml}
 *   bun interchange-fixtures.ts export <dir> <ext> <project.json>
 *        -> exporteert het opgeslagen project en vergelijkt met <dir>/sample.<ext>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
	RATE_25,
	buildInterchangeTimeline,
	parseInterchange,
	serializeInterchange,
	sortClips,
	type InterchangeFormat,
	type InterchangeTimeline,
} from "../../apps/web/src/services/interchange";

const [mode, dir, ext, projectFile] = process.argv.slice(2);
const TPS = 120000;
const b = 25;
const clip = (id: string, recordIn: number, duration: number, media: string, over = {}) => ({
	id, name: id, kind: "video" as const, track: 0, media, recordIn, duration, sourceIn: 0, speed: 1, ...over,
});
const sample: InterchangeTimeline = {
	name: "Roundtrip e2e",
	rate: RATE_25,
	width: 1920,
	height: 1080,
	startFrame: 3600 * b,
	dropFrame: false,
	clips: [
		clip("a", 0, b * 5, "interview-a.mp4", { sourceIn: b * 2 }),
		clip("b", b * 5, b * 3, "b-roll.mov", { sourceIn: 40 }),
		clip("c", b * 10, b * 4, "b-roll.mov", { sourceIn: 400 }),
		clip("d", b * 11, b * 2, "overlay.png", { track: 1 }),
		clip("e", 0, b * 14, "muziek.wav", { kind: "audio" }),
	],
};

if (mode === "gen") {
	mkdirSync(dir, { recursive: true });
	for (const f of ["edl", "otio", "fcpxml"] as InterchangeFormat[]) {
		writeFileSync(`${dir}/sample.${f}`, serializeInterchange(f, sample));
	}
	console.log("fixtures geschreven");
} else {
	const project = JSON.parse(readFileSync(projectFile, "utf8"));
	const names = JSON.parse(readFileSync(`${dir}/assets.json`, "utf8")) as { id: string; name: string }[];
	// SerializedProject: ticks als getallen, scenes[].tracks identiek aan TProject
	const back = buildInterchangeTimeline({ project, assets: names, ticksPerSecond: TPS });
	const format = ext as InterchangeFormat;
	const exported = serializeInterchange(format, back);
	const original = readFileSync(`${dir}/sample.${ext}`, "utf8");
	const key = (t: InterchangeTimeline) =>
		sortClips(t.clips).map((c) => [c.kind, c.track, c.recordIn, c.duration, c.sourceIn, c.media, c.speed].join("|")).sort();
	const reparsed = parseInterchange(format, original, RATE_25);
	// de OTIO-parser nummert clip-id's opnieuw (otio-N); verder moet de tekst byte-gelijk zijn
	const norm = (t: string) => (format === "otio" ? t.replace(/"id": "[^"]*"/g, '"id": "_"') : t);
	const sameText = norm(exported) === norm(original);
	// EDL kent één videotrack: de bronparse legt de overlay op track 0, het project op track 1 -> tekst beslist
	const sameClips = format === "edl" ? sameText : JSON.stringify(key(back)) === JSON.stringify(key(reparsed));
	console.log(JSON.stringify({ format, clips: back.clips.length, sameClips, sameText }));
	if (!sameClips || !sameText) {
		console.error(key(back), key(reparsed));
		process.exit(1);
	}
	if (!sameText) writeFileSync(`${dir}/exported.${ext}`, exported);
}
