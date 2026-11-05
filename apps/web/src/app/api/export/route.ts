import { NextRequest, NextResponse } from "next/server";

/**
 * DGDH CUT v2 — Fase 1 render-koppeling (server-render via de CUT Engine).
 *
 * De browser stuurt een multipart POST met:
 *   - veld `timeline`      : JSON van het project (TProject).
 *   - per gebruikt mediaId : een veld genaamd `<mediaId><ext>` met de blob.
 *
 * Deze route uploadt elke blob naar de CUT Engine (POST /api/media-upload),
 * bouwt een mediaId -> filename map, mapt de timeline naar het
 * /api/export-contract van de Engine ({output_size, clips, captions}), roept
 * die aan en streamt de gerenderde MP4 terug naar de browser.
 *
 * Bewust BUITEN scope voor Fase 1 (zie MAPPING hieronder): effecten, masks,
 * animaties, audio-mix, overlay-tracks en multi-scene. Alleen de main-scene
 * (isMain) en de main video-track + text-tracks worden gerenderd.
 */

const DEFAULT_CUT_ENGINE_URL = "http://localhost:8765";

const CUT_ENGINE_URL = (
	process.env.CUT_ENGINE_URL || DEFAULT_CUT_ENGINE_URL
).replace(/\/+$/, "");

// MediaTime is een integer-tick teller. opencut-wasm stelt 120_000 ticks per
// seconde (rust/crates/time/src/media_time.rs). De timeline-JSON bevat die
// ticks; ffmpeg wil seconden.
const TICKS_PER_SECOND = 120_000;

const ALLOWED_EXTENSIONS = new Set([
	".mp4",
	".mov",
	".m4v",
	".webm",
	".jpg",
	".jpeg",
	".png",
	".webp",
	".heic",
]);

type EngineClip = { file: string; in: number; out?: number };
type EngineCaption = { text: string; start: number; end: number };
type EngineTimeline = {
	output_size: string;
	clips: EngineClip[];
	captions: EngineCaption[];
};

function secondsFromTicks(ticks: unknown): number {
	const n = typeof ticks === "number" && Number.isFinite(ticks) ? ticks : 0;
	return n / TICKS_PER_SECOND;
}

/**
 * Map de OpenCut TProject-JSON naar het CUT Engine /api/export-contract.
 * Happy path: alleen de main-scene, clips in startTime-volgorde (= concat-
 * volgorde), captions uit de text-tracks.
 */
function mapTimeline(
	timeline: unknown,
	filenameByMediaId: Map<string, string>,
): { payload: EngineTimeline } | { error: string } {
	const project = timeline as {
		settings?: { canvasSize?: { width?: number; height?: number } };
		scenes?: Array<{
			isMain?: boolean;
			tracks?: {
				main?: {
					elements?: Array<{
						type?: string;
						mediaId?: string;
						startTime?: number;
						trimStart?: number;
						trimEnd?: number;
						duration?: number;
					}>;
				};
				overlay?: Array<{
					type?: string;
					elements?: Array<{
						type?: string;
						startTime?: number;
						duration?: number;
						params?: { content?: unknown };
					}>;
				}>;
			};
		}>;
	};

	const canvasSize = project?.settings?.canvasSize;
	const width = canvasSize?.width;
	const height = canvasSize?.height;
	const outputSize =
		typeof width === "number" &&
		width > 0 &&
		typeof height === "number" &&
		height > 0
			? `${width}x${height}`
			: "1080x1920";

	const scenes = project?.scenes ?? [];
	const mainScene =
		scenes.find((scene) => scene?.isMain) ?? scenes[0];
	if (!mainScene) {
		return { error: "Timeline heeft geen scene." };
	}

	const mainElements = mainScene.tracks?.main?.elements ?? [];
	if (mainElements.length === 0) {
		return {
			error:
				"Geen clips in de main track. Voeg eerst een video of afbeelding toe.",
		};
	}

	const sorted = [...mainElements].sort(
		(a, b) => (a.startTime ?? 0) - (b.startTime ?? 0),
	);

	const clips: EngineClip[] = [];
	for (const element of sorted) {
		const mediaId = element.mediaId;
		if (!mediaId) {
			return { error: "Clip zonder mediaId gevonden." };
		}
		const filename = filenameByMediaId.get(mediaId);
		if (!filename) {
			return {
				error: `Media ${mediaId} is niet geüpload naar de CUT Engine.`,
			};
		}

		const trimStart = secondsFromTicks(element.trimStart);
		const duration = secondsFromTicks(element.duration);

		if (element.type === "image") {
			clips.push({ file: filename, in: 0, out: duration });
			continue;
		}

		// video: out = trimEnd, of trimStart + duration als trimEnd 0 is.
		const trimEnd = secondsFromTicks(element.trimEnd);
		const out = trimEnd > 0 ? trimEnd : trimStart + duration;
		clips.push({ file: filename, in: trimStart, out });
	}

	const captions: EngineCaption[] = [];
	for (const track of mainScene.tracks?.overlay ?? []) {
		if (track.type !== "text") {
			continue;
		}
		for (const element of track.elements ?? []) {
			const text =
				typeof element.params?.content === "string"
					? element.params.content.trim()
					: "";
			if (!text) {
				continue;
			}
			const start = secondsFromTicks(element.startTime);
			const duration = secondsFromTicks(element.duration);
			captions.push({ text, start, end: start + duration });
		}
	}

	return { payload: { output_size: outputSize, clips, captions } };
}

function extensionFromMimeType(mimeType: string): string {
	const map: Record<string, string> = {
		"video/mp4": ".mp4",
		"video/quicktime": ".mov",
		"video/x-m4v": ".m4v",
		"video/webm": ".webm",
		"image/jpeg": ".jpg",
		"image/png": ".png",
		"image/webp": ".webp",
		"image/heic": ".heic",
	};
	return map[mimeType] ?? "";
}

export async function POST(request: NextRequest) {
	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return NextResponse.json(
			{ error: "Verwachte multipart/form-data body." },
			{ status: 400 },
		);
	}

	const timelineRaw = form.get("timeline");
	if (typeof timelineRaw !== "string") {
		return NextResponse.json(
			{ error: "Veld 'timeline' ontbreekt." },
			{ status: 400 },
		);
	}

	let timeline: unknown;
	try {
		timeline = JSON.parse(timelineRaw);
	} catch {
		return NextResponse.json(
			{ error: "Ongeldige timeline-JSON." },
			{ status: 400 },
		);
	}

	// Verzamel media-blobs. Veldnaam = "<mediaId><ext>".
	const mediaEntries: Array<{
		mediaId: string;
		ext: string;
		file: File;
	}> = [];
	form.forEach((value, key) => {
		if (key === "timeline") {
			return;
		}
		if (!(value instanceof File)) {
			return;
		}
		const dot = key.lastIndexOf(".");
		const ext = dot >= 0 ? key.slice(dot).toLowerCase() : "";
		const mediaId = dot >= 0 ? key.slice(0, dot) : key;
		mediaEntries.push({ mediaId, ext, file: value });
	});

	const filenameByMediaId = new Map<string, string>();
	for (const entry of mediaEntries) {
		const safeExt = ALLOWED_EXTENSIONS.has(entry.ext)
			? entry.ext
			: extensionFromMimeType(entry.file.type || "");
		const uploadForm = new FormData();
		const uploadFile = new File(
			[entry.file],
			`${entry.mediaId}${safeExt}`,
			{ type: entry.file.type || "application/octet-stream" },
		);
		uploadForm.append("file", uploadFile);

		let uploadResponse: Response;
		try {
			uploadResponse = await fetch(
				`${CUT_ENGINE_URL}/api/media-upload`,
				{ method: "POST", body: uploadForm },
			);
		} catch (error) {
			return NextResponse.json(
				{ error: `CUT Engine niet bereikbaar: ${String(error)}` },
				{ status: 502 },
			);
		}
		if (!uploadResponse.ok) {
			const bodyText = await uploadResponse.text();
			return NextResponse.json(
				{
					error: `Media-upload ${entry.mediaId} mislukt (${uploadResponse.status}): ${bodyText}`,
				},
				{ status: 502 },
			);
		}
		const uploadData = (await uploadResponse.json()) as {
			ok?: boolean;
			file?: string;
		};
		if (!uploadData.ok || !uploadData.file) {
			return NextResponse.json(
				{ error: `Media-upload ${entry.mediaId} gaf geen file terug.` },
				{ status: 502 },
			);
		}
		filenameByMediaId.set(entry.mediaId, uploadData.file);
	}

	const mapped = mapTimeline(timeline, filenameByMediaId);
	if ("error" in mapped) {
		return NextResponse.json({ error: mapped.error }, { status: 400 });
	}

	let exportResponse: Response;
	try {
		exportResponse = await fetch(`${CUT_ENGINE_URL}/api/export`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(mapped.payload),
		});
	} catch (error) {
		return NextResponse.json(
			{ error: `CUT Engine niet bereikbaar bij export: ${String(error)}` },
			{ status: 502 },
		);
	}
	if (!exportResponse.ok) {
		const bodyText = await exportResponse.text();
		return NextResponse.json(
			{
				error: `CUT Engine export mislukt (${exportResponse.status}): ${bodyText}`,
			},
			{ status: 502 },
		);
	}
	const exportData = (await exportResponse.json()) as {
		ok?: boolean;
		preview?: string;
	};
	if (!exportData.preview) {
		return NextResponse.json(
			{ error: "CUT Engine gaf geen preview-pad terug." },
			{ status: 502 },
		);
	}

	// Haal de gerenderde MP4 op en stream hem terug.
	let mp4Response: Response;
	try {
		mp4Response = await fetch(`${CUT_ENGINE_URL}${exportData.preview}`);
	} catch (error) {
		return NextResponse.json(
			{ error: `Rendered MP4 niet op te halen: ${String(error)}` },
			{ status: 502 },
		);
	}
	if (!mp4Response.ok || !mp4Response.body) {
		return NextResponse.json(
			{ error: `Rendered MP4 niet op te halen (${mp4Response.status}).` },
			{ status: 502 },
		);
	}

	const headers = new Headers();
	headers.set(
		"Content-Type",
		mp4Response.headers.get("Content-Type") || "video/mp4",
	);
	headers.set(
		"Content-Disposition",
		`attachment; filename="render-${Date.now()}.mp4"`,
	);
	const contentLength = mp4Response.headers.get("Content-Length");
	if (contentLength) {
		headers.set("Content-Length", contentLength);
	}

	return new Response(mp4Response.body, { status: 200, headers });
}
