import { access } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { Scope } from "./keys";

/**
 * Single tool registry for the CUT agent surface. MCP (/api/mcp) and REST (/api/v1/tools/<name>)
 * both dispatch from here, so scopes, units and behaviour can never drift apart.
 */
export type ToolCtx = { origin: string };
export type ToolDef = {
	name: string;
	description: string;
	scope: Scope;
	units: number; // metering weight per call
	shape: z.ZodRawShape;
	run: (args: any, ctx: ToolCtx) => Promise<unknown>;
};

const ENGINE = () => (process.env.CUT_ENGINE_URL || "http://localhost:8765").replace(/\/$/, "");
const MAX_UPLOAD = 95 * 1024 * 1024;

export class ToolError extends Error {}

async function engine(path: string, body?: unknown, form?: FormData): Promise<any> {
	const res = await fetch(`${ENGINE()}${path}`, {
		method: body === undefined && !form ? "GET" : "POST",
		headers: form ? undefined : body === undefined ? undefined : { "content-type": "application/json" },
		body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
	}).catch(() => null);
	if (!res) throw new ToolError("CUT Engine unreachable");
	const j = await res.json().catch(() => null);
	if (!res.ok || !j || j.ok === false) throw new ToolError(j?.error ?? `engine ${res.status}`);
	return j;
}

/** Make engine output agent-friendly: absolute, key-protected download link. */
const withLinks = (r: any, ctx: ToolCtx) => {
	const file = typeof r?.preview === "string" ? r.preview.replace(/^\/media\//, "") : r?.file;
	return file ? { ...r, file, download_url: `${ctx.origin}/api/v1/media/${encodeURIComponent(file)}` } : r;
};

const file = z.string().min(1).describe("Media-bin file name (from list_media or upload_media_from_url)");
const size = z.string().regex(/^\d{3,4}x\d{3,4}$/).optional().describe('e.g. "1080x1920"');

const t = (d: ToolDef) => d;
export const TOOLS: ToolDef[] = [
	t({
		name: "list_media", scope: "media:read", units: 1,
		description: "List files in the CUT media bin (name, kind, bytes, duration).",
		shape: {},
		run: async () => engine("/api/media-bin"),
	}),
	t({
		name: "list_catalog", scope: "media:read", units: 1,
		description: "List available LUTs, templates, transitions or SFX for use in grade/compose/sfx_mix.",
		shape: { kind: z.enum(["luts", "templates", "transitions", "sfx"]) },
		run: async ({ kind }) => engine(kind === "sfx" ? "/api/sfx-library" : `/api/${kind}`),
	}),
	t({
		name: "upload_media_from_url", scope: "media:write", units: 2,
		description: "Fetch a video/image from an https URL into the media bin (max 95 MB; mp4 mov m4v webm jpg png webp heic).",
		shape: { url: z.url().describe("https URL to download"), name: z.string().regex(/^[\w.-]+$/).optional().describe("target file name incl. extension") },
		run: async ({ url, name }) => {
			if (!/^https:\/\//i.test(url)) throw new ToolError("only https URLs");
			const res = await fetch(url, { redirect: "follow" }).catch(() => null);
			if (!res?.ok) throw new ToolError(`download failed (${res?.status ?? "network"})`);
			const buf = await res.arrayBuffer();
			if (buf.byteLength > MAX_UPLOAD) throw new ToolError("file exceeds 95 MB");
			const fname = name ?? (new URL(url).pathname.split("/").pop() || "upload.mp4");
			const form = new FormData();
			form.append("file", new Blob([buf]), fname);
			return engine("/api/media-upload", undefined, form);
		},
	}),
	t({
		name: "build_reel", scope: "transcribe", units: 10,
		description: "Auto-reel: transcribe speech and cut silences from one clip, output a vertical reel.",
		shape: { file, output_size: size },
		run: async (a, c) => withLinks(await engine("/api/auto-reel", a), c),
	}),
	t({
		name: "compose", scope: "render", units: 5,
		description: "Compose a reel from a template + clips, or from an explicit timeline ({output_size, clips:[{file,in,out,grade?,transition?,effects?}], captions?, sfx?, music?}).",
		shape: {
			template: z.string().optional().describe("product-promo | talking-head-reel | cinematic-trailer"),
			clips: z.array(z.string()).optional().describe("file names when using a template"),
			title: z.string().optional(),
			output_size: size,
			timeline: z.record(z.string(), z.unknown()).optional(),
		},
		run: async (a, c) => withLinks(await engine("/api/compose", a), c),
	}),
	t({
		name: "grade", scope: "render", units: 3,
		description: "Colour-grade a clip with a LUT and/or brightness/contrast/saturation/gamma.",
		shape: { file, lut: z.string().optional(), brightness: z.number().optional(), contrast: z.number().optional(), saturation: z.number().optional(), gamma: z.number().optional() },
		run: async (a, c) => withLinks(await engine("/api/grade", a), c),
	}),
	t({
		name: "karaoke", scope: "transcribe", units: 10,
		description: "Transcribe and burn word-by-word karaoke captions into the video.",
		shape: { file, font_size: z.number().optional(), highlight_color: z.string().optional(), effect: z.string().optional() },
		run: async (a, c) => withLinks(await engine("/api/karaoke", a), c),
	}),
	t({
		name: "reframe", scope: "render", units: 4,
		description: "Reframe a video to another aspect ratio (e.g. 1080x1920).",
		shape: { file, output_size: size },
		run: async (a, c) => withLinks(await engine("/api/reframe", a), c),
	}),
	t({
		name: "sfx_mix", scope: "render", units: 3,
		description: "Mix sound effects into a video: auto (on cuts) or explicit cues [{t, category}].",
		shape: { file, auto: z.boolean().optional(), cues: z.array(z.object({ t: z.number(), category: z.string() })).optional() },
		run: async (a, c) => withLinks(await engine("/api/sfx-mix", a), c),
	}),
	t({
		name: "voiceover", scope: "voice", units: 8,
		description: "Generate a voice-over from text (ElevenLabs) into the media bin.",
		shape: { text: z.string().min(1).max(5000), voice_id: z.string().optional(), model: z.string().optional(), file: z.string().optional() },
		run: async (a, c) => withLinks(await engine("/api/voiceover", a), c),
	}),
	t({
		name: "export", scope: "render", units: 5,
		description: "Export a timeline JSON to a preset (9:16 1:1 4:5 16:9), thumbnail or gif.",
		shape: { timeline: z.record(z.string(), z.unknown()), preset: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(), format: z.enum(["thumbnail", "gif"]).optional(), loop: z.boolean().optional() },
		run: async ({ timeline, ...rest }, c) => withLinks(await engine("/api/export", { ...timeline, ...rest }), c),
	}),
	t({
		name: "open_in_editor", scope: "editor", units: 1,
		description: "Return the link that opens an agent-built project (inbox id from POST /api/agent/projects) in the CUT editor. The user must be signed in to the DGDH Suite.",
		shape: { project_id: z.uuid() },
		run: async ({ project_id }, ctx) => {
			const dir = process.env.CUT_AGENT_INBOX || join(process.cwd(), ".agent-inbox");
			await access(join(dir, `${project_id}.json`)).catch(() => { throw new ToolError("unknown project_id"); });
			const base = (process.env.CUT_APP_URL || ctx.origin).replace(/\/$/, "");
			return { ok: true, url: `${base}/agent?id=${project_id}` };
		},
	}),
];

export const toolByName = (n: string) => TOOLS.find((x) => x.name === n);
