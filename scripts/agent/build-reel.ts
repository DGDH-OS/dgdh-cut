#!/usr/bin/env bun
/**
 * DGDH CUT — headless agent pipeline.
 *
 *   bun scripts/agent/build-reel.ts --media clip.mp4 [--media b.mp4] \
 *       [--brief brief.json] [--name "My reel"] [--out ./inbox | --post http://localhost:3104]
 *
 * Talks to the CUT Engine (server.py, default http://localhost:8765), renders a
 * baked reel (compose [+ karaoke] [+ sfx-mix]) and writes the result as an
 * editable OpenCut project JSON ("dgdh-cut-agent-project/v1") to the agent
 * inbox, or POSTs it to /api/agent/projects. See docs/AGENT-API.md.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

const TICKS_PER_SECOND = 120_000;
const ENGINE = (process.env.CUT_ENGINE_URL || "http://localhost:8765").replace(/\/$/, "");
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

type Brief = {
	name?: string;
	title?: string;
	output_size?: string; // "1080x1920"
	autoReel?: boolean; // transcribe + cut silences (single speech clip)
	clips?: { file: string; in?: number; out?: number; lut?: string }[];
	grade?: { lut?: string };
	captions?: { text: string; start: number; end: number }[];
	sfx?: boolean | { t: number; category: string }[];
	karaoke?: boolean;
};

function arg(name: string): string[] {
	const out: string[] = [];
	const a = process.argv.slice(2);
	for (let i = 0; i < a.length; i++) if (a[i] === `--${name}` && a[i + 1]) out.push(a[++i]);
	return out;
}

const log = (m: string) => console.error(`[build-reel] ${m}`);

async function engine<T = any>(path: string, body?: unknown, form?: FormData): Promise<T> {
	const res = await fetch(`${ENGINE}${path}`, {
		method: body || form ? "POST" : "GET",
		headers: body ? { "content-type": "application/json" } : undefined,
		body: form ?? (body ? JSON.stringify(body) : undefined),
	});
	const data: any = await res.json().catch(() => ({}));
	if (!res.ok || data.ok === false) throw new Error(`${path}: ${data.error ?? res.status}`);
	return data;
}

async function main() {
	const mediaArgs = arg("media");
	const briefPath = arg("brief")[0];
	const brief: Brief = briefPath ? JSON.parse(readFileSync(briefPath, "utf8")) : {};
	const name = arg("name")[0] || brief.name || "Agent reel";
	const outDir = arg("out")[0] || process.env.CUT_AGENT_INBOX || join(process.cwd(), ".agent-inbox");
	const postUrl = arg("post")[0];
	const outputSize = brief.output_size || "1080x1920";
	const [W, H] = outputSize.split("x").map(Number);
	const steps: { step: string; ok: boolean; detail?: string }[] = [];

	await engine("/api/health");

	// 1. media → engine media-bin
	const files: string[] = [];
	for (const m of mediaArgs) {
		if (existsSync(m)) {
			const form = new FormData();
			form.append("file", new Blob([readFileSync(m)]), basename(m));
			const up = await engine<{ file: string }>("/api/media-upload", undefined, form);
			files.push(up.file);
			steps.push({ step: "media-upload", ok: true, detail: `${m} -> ${up.file}` });
		} else files.push(m); // already a media-bin name
	}
	const bin = (await engine<{ items: any[] }>("/api/media-bin")).items;
	const info = (f: string) => {
		const it = bin.find((i) => i.file === f);
		if (!it) throw new Error(`media-bin has no ${f}`);
		return it as { file: string; kind: string; duration_s?: number };
	};

	// 2. clips (explicit > autoReel > full length)
	let clips: { file: string; in: number; out: number; lut?: string }[] = [];
	let captions = brief.captions ?? [];
	if (brief.clips?.length) {
		clips = brief.clips.map((c) => ({ ...c, in: c.in ?? 0, out: c.out ?? info(c.file).duration_s ?? 3 }));
	} else if (brief.autoReel && files.length === 1) {
		try {
			const r = await engine("/api/auto-reel", { file: files[0], output_size: outputSize });
			clips = r.timeline.clips;
			captions = r.timeline.captions ?? captions;
			steps.push({ step: "auto-reel", ok: true, detail: `${r.clips_used} clips, ${r.captions_used} captions` });
		} catch (e) {
			steps.push({ step: "auto-reel", ok: false, detail: String(e) });
		}
	}
	if (!clips.length)
		clips = files.map((f) => ({ file: f, in: 0, out: info(f).duration_s ?? 3 }));
	if (brief.title && !captions.length) captions = [{ text: brief.title, start: 0, end: Math.min(2.5, clips[0].out - clips[0].in) }];

	const total = clips.reduce((s, c) => s + (c.out - c.in), 0);

	// 3. sfx cues (explicit list, or whoosh at cuts + hit at start)
	let cues: { t: number; category: string }[] = [];
	if (Array.isArray(brief.sfx)) cues = brief.sfx;
	else if (brief.sfx) {
		cues = [{ t: 0, category: "hit" }];
		let t = 0;
		clips.slice(0, -1).forEach((c) => {
			t += c.out - c.in;
			cues.push({ t: +Math.max(0, t - 0.2).toFixed(2), category: "whoosh" });
		});
	}

	// 4. baked render: compose (+ karaoke) (+ sfx via compose cues)
	const renderTl = {
		output_size: outputSize,
		clips: clips.map((c) => {
			const lut = c.lut ?? brief.grade?.lut;
			return { file: c.file, in: c.in, out: c.out, ...(lut ? { grade: { lut } } : {}) };
		}),
		captions: captions.map((c) => ({ text: c.text, start: c.start, end: c.end })),
		sfx: cues,
	};
	const composed = await engine("/api/compose", { timeline: renderTl });
	let renderFile = (composed.preview as string).replace("/media/", "");
	steps.push({ step: "compose", ok: true, detail: `${renderFile} ${composed.bytes}B` });
	if (brief.karaoke) {
		try {
			const k = await engine("/api/karaoke", { file: renderFile });
			renderFile = (k.preview as string).replace("/media/", "");
			steps.push({ step: "karaoke", ok: true, detail: `${renderFile} words=${k.words_used}` });
		} catch (e) {
			steps.push({ step: "karaoke", ok: false, detail: String(e) });
		}
	}

	// 5. editable project JSON (TProject serialised form, ticks = 1/120000 s)
	const tk = (s: number) => Math.round(s * TICKS_PER_SECOND);
	const uid = () => crypto.randomUUID();
	const now = new Date().toISOString();
	const media: any[] = [];
	const mediaId = new Map<string, string>();
	const addMedia = (file: string, role: "source" | "render") => {
		if (mediaId.has(file)) return mediaId.get(file)!;
		const i = bin.find((x) => x.file === file) ?? (role === "render" ? null : info(file));
		const id = uid();
		mediaId.set(file, id);
		media.push({
			id, file, role, name: file, type: VIDEO_EXT.test(file) ? "video" : "image",
			url: `/api/engine/media/${file}`, duration_s: i?.duration_s ?? total,
		});
		return id;
	};

	let cursor = 0;
	const mainEls = clips.map((c) => {
		const full = info(c.file).duration_s ?? c.out;
		const dur = c.out - c.in;
		const el = {
			id: uid(), type: "video", mediaId: addMedia(c.file, "source"), name: c.file,
			startTime: tk(cursor), duration: tk(dur), trimStart: tk(c.in),
			trimEnd: tk(Math.max(0, full - c.out)), sourceDuration: tk(full),
			isSourceAudioEnabled: true, hidden: false, params: {},
		};
		cursor += dur;
		return el;
	});
	const textEls = captions.map((c) => ({
		id: uid(), type: "text", name: c.text.slice(0, 24), startTime: tk(c.start),
		duration: tk(Math.max(0.1, c.end - c.start)), trimStart: 0, trimEnd: 0,
		params: { content: c.text, fontSize: 12 },
	}));

	let audioEls: any[] = [];
	if (cues.length) {
		const lib = await engine<{ sounds: { file: string; category: string; duration_s: number }[] }>("/api/sfx-library");
		audioEls = cues.flatMap((q) => {
			const s = lib.sounds.find((x) => x.category === q.category);
			if (!s) return [];
			return [{
				id: uid(), type: "audio", sourceType: "library", name: `${q.category}`,
				sourceUrl: `/api/engine/sfx/${s.file}`, startTime: tk(q.t), duration: tk(s.duration_s),
				trimStart: 0, trimEnd: 0, sourceDuration: tk(s.duration_s), params: {},
			}];
		});
	}
	addMedia(renderFile, "render"); // baked reel sits in the media bin for reference/compare

	const sceneId = uid();
	const project = {
		metadata: { id: uid(), name, duration: tk(total), createdAt: now, updatedAt: now },
		scenes: [{
			id: sceneId, name: "Main scene", isMain: true, bookmarks: [], createdAt: now, updatedAt: now,
			tracks: {
				main: { id: uid(), name: "Main track", type: "video", muted: false, hidden: false, elements: mainEls },
				overlay: textEls.length ? [{ id: uid(), name: "Captions", type: "text", hidden: false, elements: textEls }] : [],
				audio: audioEls.length ? [{ id: uid(), name: "SFX", type: "audio", muted: false, elements: audioEls }] : [],
			},
		}],
		currentSceneId: sceneId,
		settings: {
			fps: { numerator: 30, denominator: 1 },
			canvasSize: { width: W, height: H },
			canvasSizeMode: "preset", lastCustomCanvasSize: null, originalCanvasSize: null,
			background: { type: "color", color: "#000000" },
		},
		version: 31,
	};
	const payload = {
		schema: "dgdh-cut-agent-project/v1",
		project, media,
		engine: { url: ENGINE, render: { file: renderFile, preview: `/media/${renderFile}` }, steps },
	};

	if (postUrl) {
		const res = await fetch(`${postUrl.replace(/\/$/, "")}/api/agent/projects`, {
			method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
		});
		const j = await res.json();
		if (!res.ok) throw new Error(`POST /api/agent/projects: ${JSON.stringify(j)}`);
		log(`posted: ${JSON.stringify(j)}`);
	} else {
		mkdirSync(outDir, { recursive: true });
		const f = join(outDir, `${project.metadata.id}.json`);
		writeFileSync(f, JSON.stringify(payload, null, 2));
		log(`written: ${f}`);
	}
	console.log(JSON.stringify({ ok: true, id: project.metadata.id, name, duration_s: total, steps, render: renderFile }));
}

main().catch((e) => {
	console.error(`[build-reel] FAILED: ${e instanceof Error ? e.message : e}`);
	process.exit(1);
});
