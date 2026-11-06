/**
 * Koppelstap voor import: EDL/OTIO/FCPXML-tijdlijn + gekoppelde mediabestanden
 * -> TProject. Zuiver (geen opslag, geen DOM), dus unit-testbaar. De opslag
 * zit in import-service.ts.
 */
import type { TProject } from "@/project/types";
import type {
	AudioTrack,
	OverlayTrack,
	TScene,
	TimelineElement,
	VideoTrack,
} from "@/timeline/types";
import type { MediaTime } from "@/wasm";
import { generateUUID } from "@/utils/id";
import {
	INTERCHANGE_FORMATS,
	parseInterchange,
	type InterchangeFormat,
} from "./index";
import {
	RATE_24,
	RATE_25,
	RATE_2997,
	RATE_30,
	RATE_5994,
	RATE_60,
	framesToTicks,
	type Rate,
} from "./timecode";
import type { InterchangeClip, InterchangeKind, InterchangeTimeline } from "./types";

export const IMPORT_RATES: { id: string; label: string; rate: Rate }[] = [
	{ id: "24", label: "24 fps", rate: RATE_24 },
	{ id: "25", label: "25 fps", rate: RATE_25 },
	{ id: "2997", label: "29,97 fps", rate: RATE_2997 },
	{ id: "30", label: "30 fps", rate: RATE_30 },
	{ id: "5994", label: "59,94 fps", rate: RATE_5994 },
	{ id: "60", label: "60 fps", rate: RATE_60 },
];

export function detectInterchangeFormat({
	fileName,
	text,
}: {
	fileName: string;
	text: string;
}): InterchangeFormat | null {
	const ext = fileName.toLowerCase().split(".").pop() ?? "";
	if ((INTERCHANGE_FORMATS as readonly string[]).includes(ext)) {
		return ext as InterchangeFormat;
	}
	const head = text.trimStart().slice(0, 400);
	if (head.startsWith("<")) return head.includes("fcpxml") ? "fcpxml" : null;
	if (head.startsWith("{") && head.includes("OTIO_SCHEMA")) return "otio";
	if (/^TITLE:|^FCM:|^\d{3}\s/m.test(head)) return "edl";
	return null;
}

// ---------- koppelen bestandsnaam -> mediabestand ----------

export type MediaRef = { name: string; clips: number; kind: InterchangeKind };

export function listMediaRefs(timeline: InterchangeTimeline): MediaRef[] {
	const map = new Map<string, MediaRef>();
	for (const clip of timeline.clips) {
		const existing = map.get(clip.media);
		if (existing) existing.clips += 1;
		else map.set(clip.media, { name: clip.media, clips: 1, kind: clip.kind });
	}
	return [...map.values()];
}

const stem = (name: string) =>
	name
		.replace(/^.*[\\/]/, "")
		.replace(/\.[^.]+$/, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");

export type MatchMethod = "naam" | "bestandsnaam" | "reel";
export type MediaMatch = { fileIndex: number; method: MatchMethod };

/**
 * Auto-match op: 1) exacte naam, 2) naam zonder extensie/leestekens,
 * 3) EDL-reel (max. 8 tekens, hoofdletters) als unieke prefix van een bestand.
 * Een bestand wordt maximaal aan één verwijzing gekoppeld.
 */
export function autoMatchMedia({
	refs,
	fileNames,
}: {
	refs: string[];
	fileNames: string[];
}): Record<string, MediaMatch> {
	const result: Record<string, MediaMatch> = {};
	const used = new Set<number>();
	const take = (ref: string, index: number, method: MatchMethod) => {
		result[ref] = { fileIndex: index, method };
		used.add(index);
	};
	const free = (i: number) => !used.has(i);
	const passes: ((ref: string) => number[]) [] = [
		(ref) =>
			fileNames.flatMap((f, i) =>
				free(i) && f.replace(/^.*[\\/]/, "") === ref.replace(/^.*[\\/]/, "") ? [i] : [],
			),
		(ref) =>
			fileNames.flatMap((f, i) => (free(i) && stem(f) && stem(f) === stem(ref) ? [i] : [])),
		(ref) =>
			fileNames.flatMap((f, i) =>
				free(i) && stem(ref).length >= 3 && stem(f).startsWith(stem(ref)) ? [i] : [],
			),
	];
	const methods: MatchMethod[] = ["naam", "bestandsnaam", "reel"];
	passes.forEach((pass, p) => {
		for (const ref of refs) {
			if (result[ref]) continue;
			const hits = pass(ref);
			if (hits.length === 1 || (hits.length > 1 && p < 2)) take(ref, hits[0], methods[p]);
		}
	});
	return result;
}

// ---------- bouwen van het project ----------

export type ImportMedia = {
	id: string;
	type: "video" | "image" | "audio";
	/** Duur van de bron in seconden, indien bekend. */
	durationSeconds?: number;
};

export type BuildImportResult = {
	project: TProject;
	placed: number;
	skipped: { clip: InterchangeClip; reason: string }[];
};

/** Hulpfuncties uit de editor zelf (wasm), geïnjecteerd zodat dit bestand zuiver blijft. */
export type ImportDeps = {
	buildScene: () => TScene;
	buildElement: (args: {
		mediaId: string;
		mediaType: "video" | "image" | "audio";
		name: string;
		duration: MediaTime;
		startTime: MediaTime;
	}) => Record<string, unknown>;
	version: number;
	backgroundColor: string;
};

const mediaTime = ({ ticks }: { ticks: number }) => Math.round(ticks) as MediaTime;

function toElement({
	clip,
	media,
	rate,
	ticksPerSecond,
	buildElement,
	id,
}: {
	id: string;
	buildElement: ImportDeps["buildElement"];
	clip: InterchangeClip;
	media: ImportMedia;
	rate: Rate;
	ticksPerSecond: number;
}): TimelineElement {
	const t = (frames: number): MediaTime =>
		mediaTime({ ticks: framesToTicks({ frames, ticksPerSecond, rate }) });
	const duration = t(clip.duration);
	const trimStart = t(clip.sourceIn);
	const used = t(Math.round(clip.duration * clip.speed));
	const known =
		media.durationSeconds != null
			? mediaTime({ ticks: Math.round(media.durationSeconds * ticksPerSecond) })
			: null;
	const sourceDuration = (
		known != null && known >= trimStart + used ? known : trimStart + used
	) as MediaTime;
	const trimEnd = (sourceDuration - trimStart - used) as MediaTime;
	const mediaType = clip.kind === "audio" ? "audio" : media.type === "audio" ? "audio" : media.type;
	const built = buildElement({
		mediaId: media.id,
		mediaType,
		name: clip.name || clip.media,
		duration,
		startTime: t(clip.recordIn),
	});
	return {
		...built,
		id,
		trimStart,
		trimEnd,
		sourceDuration,
		...(clip.speed !== 1 && { retime: { rate: clip.speed, maintainPitch: true } }),
	} as unknown as TimelineElement;
}

/** Bouwt een nieuw project met de clips op hun tijden en tracks. */
export function buildProjectFromInterchange({
	timeline,
	media,
	name,
	ticksPerSecond,
	deps,
}: {
	deps: ImportDeps;
	timeline: InterchangeTimeline;
	media: Record<string, ImportMedia | undefined>;
	name?: string;
	ticksPerSecond: number;
}): BuildImportResult {
	const scene = deps.buildScene();
	const skipped: BuildImportResult["skipped"] = [];
	const main: VideoTrack = { ...scene.tracks.main, elements: [] };
	const overlays = new Map<number, VideoTrack>();
	const audios = new Map<number, AudioTrack>();
	let placed = 0;
	const usedIds = new Set<string>();
	// Einde van de laatste clip per (soort, track): overlappende clips (EDL kent maar één
	// videotrack) schuiven door naar de eerstvolgende vrije track in plaats van over elkaar te vallen.
	const trackEnd = new Map<string, number>();
	const freeTrack = (kind: string, wanted: number, start: number, end: number) => {
		let track = wanted;
		while ((trackEnd.get(`${kind}:${track}`) ?? -1) > start) track += 1;
		trackEnd.set(`${kind}:${track}`, end);
		return track;
	};

	const clips = [...timeline.clips].sort((a, b) => a.recordIn - b.recordIn);
	for (const clip of clips) {
		const asset = media[clip.media];
		if (!asset) {
			skipped.push({ clip, reason: "geen mediabestand gekoppeld" });
			continue;
		}
		const element = toElement({
			clip,
			media: asset,
			rate: timeline.rate,
			ticksPerSecond,
			buildElement: deps.buildElement,
			// behoud het clip-id uit het bestand (stabiele roundtrip), tenzij dubbel
			id: clip.id && !usedIds.has(clip.id) ? clip.id : generateUUID(),
		});
		usedIds.add(element.id);
		const laneIndex = freeTrack(
			clip.kind,
			clip.track,
			clip.recordIn,
			clip.recordIn + clip.duration,
		);
		if (clip.kind === "audio") {
			let track = audios.get(laneIndex);
			if (!track) {
				track = {
					id: generateUUID(),
					name: `Audio ${laneIndex + 1}`,
					type: "audio",
					elements: [],
					muted: false,
				};
				audios.set(laneIndex, track);
			}
			track.elements.push(element as AudioTrack["elements"][number]);
		} else if (laneIndex === 0) {
			main.elements.push(element as VideoTrack["elements"][number]);
		} else {
			let track = overlays.get(laneIndex);
			if (!track) {
				track = {
					id: generateUUID(),
					name: `Video ${laneIndex + 1}`,
					type: "video",
					elements: [],
					muted: false,
					hidden: false,
				};
				overlays.set(laneIndex, track);
			}
			track.elements.push(element as VideoTrack["elements"][number]);
		}
		placed += 1;
	}

	const byKey = <T,>(m: Map<number, T>) =>
		[...m.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
	const tracks = {
		main,
		// hoogste videotrack bovenaan: overlays staan in omgekeerde volgorde van index
		overlay: byKey(overlays).reverse() as OverlayTrack[],
		audio: byKey(audios),
	};
	const finalScene: TScene = { ...scene, tracks };
	let end = 0;
	for (const track of [main, ...byKey(overlays), ...byKey(audios)]) {
		for (const el of track.elements) end = Math.max(end, el.startTime + el.duration);
	}
	const now = new Date();
	return {
		placed,
		skipped,
		project: {
			metadata: {
				id: generateUUID(),
				name: name || timeline.name || "Geïmporteerd project",
				duration: mediaTime({ ticks: end }),
				createdAt: now,
				updatedAt: now,
			},
			scenes: [finalScene],
			currentSceneId: finalScene.id,
			settings: {
				canvasSizeMode: "preset",
				lastCustomCanvasSize: null,
				originalCanvasSize: null,
				background: { type: "color", color: deps.backgroundColor },
				fps: { numerator: timeline.rate.num, denominator: timeline.rate.den },
				canvasSize: {
					width: timeline.width || 1920,
					height: timeline.height || 1080,
				},
			},
			version: deps.version,
		},
	};
}

export function parseImportFile({
	fileName,
	text,
	rate,
}: {
	fileName: string;
	text: string;
	rate: Rate;
}): { format: InterchangeFormat; timeline: InterchangeTimeline } {
	const format = detectInterchangeFormat({ fileName, text });
	if (!format) throw new Error("Onbekend bestandstype. Kies een EDL-, FCPXML- of OTIO-bestand.");
	return { format, timeline: parseInterchange(format, text, rate) };
}
