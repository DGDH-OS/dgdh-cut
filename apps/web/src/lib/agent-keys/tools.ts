import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AgentKeyRecord, Scope } from "./keys";
import { buildPrice, type Price, type PriceInput } from "./pricing";
import { AUTO_ACCEPT_MS, effective } from "./billing";
import { getStore } from "./store";
import { applyOps, OpSchema, summarize } from "../../services/agent-import/ops";
import { getProject, listProjects, updateProject } from "../../services/agent-import/server-store";

/**
 * Single tool registry for the CUT agent surface. MCP (/api/mcp) and REST (/api/v1/tools/<name>)
 * both dispatch from here, so scopes, units and behaviour can never drift apart.
 */
export type ToolCtx = { origin: string; key: AgentKeyRecord; channel: "mcp" | "rest" };
/** Duration lookup used by price estimators (engine media-bin; falls back to an assumed length). */
export type PriceHelpers = { duration(file: string): Promise<{ s: number; assumed: boolean }> };
export const ASSUMED_DURATION_S = 60;
export type ToolDef = {
	name: string;
	description: string;
	scope: Scope;
	/** Cost model (pricing.json units). Absent = free tool (0 units, 0 EUR). */
	price?: (args: any, h: PriceHelpers) => Promise<PriceInput[]>;
	/** Render output: billed only once accepted (accept_export) or auto-accepted after 24h; until then reserved. */
	gated?: boolean;
	/** Tool writes its own usage event(s) (accept_export), runTool must not add another. */
	selfMetered?: boolean;
	shape: z.ZodRawShape;
	run: (args: any, ctx: ToolCtx) => Promise<unknown>;
};

export function priceHelpers(): PriceHelpers {
	let bin: Promise<any[] | null> | null = null;
	return {
		async duration(file) {
			bin ??= engine("/api/media-bin").then((j) => j.items as any[]).catch(() => null);
			const it = (await bin)?.find((i) => i.file === file);
			return typeof it?.duration_s === "number" && it.duration_s > 0 ? { s: it.duration_s, assumed: false } : { s: ASSUMED_DURATION_S, assumed: true };
		},
	};
}
export async function computePrice(tool: ToolDef, args: unknown, h: PriceHelpers): Promise<Price> {
	return buildPrice(tool.price ? await tool.price(args, h) : [], !!tool.gated);
}
const min = (s: number) => s / 60;
const renderPrice = (extra: PriceInput["unit"][] = []) => async (a: { file: string }, h: PriceHelpers): Promise<PriceInput[]> => {
	const d = await h.duration(a.file);
	const basis = `${d.s.toFixed(1)}s of ${a.file}${d.assumed ? " (length unknown, assumed)" : ""}`;
	return [...extra, "export_min" as const].map((unit) => ({ unit, quantity: min(d.s), basis, assumed: d.assumed }));
};
const timelineSeconds = (tl: any): number | null => Array.isArray(tl?.clips) && tl.clips.length ? tl.clips.reduce((a: number, c: any) => a + Math.max(0, Number(c.out) - Number(c.in) || 0), 0) || null : null;

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

/** Defense in depth: the engine already strips url/source/file for license-restricted
 * sounds (Mixkit/YouTubeSFX); never pass external source URLs or raw file paths to agents. */
function sanitizeSfxCatalog(lib: any): any {
	const sounds = Array.isArray(lib?.sounds) ? lib.sounds : [];
	return {
		...lib,
		sounds: sounds.map((s: any) => {
			const { url, source, file, license, license_risk, license_risk_note, tags, ...rest } = s ?? {};
			const restricted = s?.restricted !== false;
			return restricted ? { ...rest, restricted: true } : { ...rest, restricted: false, url, file, license };
		}),
	};
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
		name: "list_media", scope: "media:read",
		description: "List files in the CUT media bin (name, kind, bytes, duration).",
		shape: {},
		run: async () => engine("/api/media-bin"),
	}),
	t({
		name: "list_catalog", scope: "media:read",
		description: "List available LUTs, templates, transitions or SFX for use in grade/compose/sfx_mix.",
		shape: { kind: z.enum(["luts", "templates", "transitions", "sfx"]) },
		run: async ({ kind }) =>
			kind === "sfx" ? sanitizeSfxCatalog(await engine("/api/sfx-library")) : engine(`/api/${kind}`),
	}),
	t({
		name: "upload_media_from_url", scope: "media:write",
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
		name: "build_reel", scope: "transcribe",
		price: renderPrice(["transcribe_min"]), gated: true,
		description: "Auto-reel: transcribe speech and cut silences from one clip, output a vertical reel.",
		shape: { file, output_size: size },
		run: async (a, c) => withLinks(await engine("/api/auto-reel", a), c),
	}),
	t({
		name: "compose", scope: "render",
		price: async (a, h) => {
			let sec = timelineSeconds(a.timeline), assumed = false, basis = "sum of timeline clips (out - in)";
			if (sec == null && a.clips?.length) {
				const ds = await Promise.all((a.clips as string[]).map((f) => h.duration(f)));
				sec = ds.reduce((x, d) => x + d.s, 0); assumed = ds.some((d) => d.assumed); basis = "sum of clip lengths (upper bound, templates may trim)";
			}
			if (sec == null) { sec = 15; assumed = true; basis = "no timeline/clips given, assumed 15 s"; }
			return [{ unit: "export_min", quantity: min(sec), basis: `${sec.toFixed(1)} s: ${basis}`, assumed }];
		}, gated: true,
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
		name: "grade", scope: "render",
		price: renderPrice(), gated: true,
		description: "Colour-grade a clip with a LUT and/or brightness/contrast/saturation/gamma.",
		shape: { file, lut: z.string().optional(), brightness: z.number().optional(), contrast: z.number().optional(), saturation: z.number().optional(), gamma: z.number().optional() },
		run: async (a, c) => withLinks(await engine("/api/grade", a), c),
	}),
	t({
		name: "karaoke", scope: "transcribe",
		price: renderPrice(["transcribe_min"]), gated: true,
		description: "Transcribe and burn word-by-word karaoke captions into the video.",
		shape: { file, font_size: z.number().optional(), highlight_color: z.string().optional(), effect: z.string().optional() },
		run: async (a, c) => withLinks(await engine("/api/karaoke", a), c),
	}),
	t({
		name: "reframe", scope: "render",
		price: renderPrice(), gated: true,
		description: "Reframe a video to another aspect ratio (e.g. 1080x1920).",
		shape: { file, output_size: size },
		run: async (a, c) => withLinks(await engine("/api/reframe", a), c),
	}),
	t({
		name: "sfx_mix", scope: "render",
		price: renderPrice(), gated: true,
		description: "Mix sound effects into a video: auto (on cuts) or explicit cues [{t, category}].",
		shape: { file, auto: z.boolean().optional(), cues: z.array(z.object({ t: z.number(), category: z.string() })).optional() },
		run: async (a, c) => withLinks(await engine("/api/sfx-mix", a), c),
	}),
	t({
		name: "voiceover", scope: "voice",
		price: async (a) => [{ unit: /flash|turbo/i.test(a.model ?? "") ? "vo_fast_1k_chars" : "vo_1k_chars", quantity: a.text.length / 1000, basis: `${a.text.length} characters` }],
		description: "Generate a voice-over from text (ElevenLabs) into the media bin.",
		shape: { text: z.string().min(1).max(5000), voice_id: z.string().optional(), model: z.string().optional(), file: z.string().optional() },
		run: async (a, c) => withLinks(await engine("/api/voiceover", a), c),
	}),
	t({
		name: "export", scope: "render",
		price: async (a) => {
			const sec = a.format === "thumbnail" ? 1 : timelineSeconds(a.timeline) ?? 30;
			return [{ unit: "export_min", quantity: min(sec), basis: `${sec.toFixed(1)} s${a.format === "thumbnail" ? " (thumbnail, minimum)" : timelineSeconds(a.timeline) == null ? " (no clips given, assumed 30 s)" : ""}`, assumed: a.format !== "thumbnail" && timelineSeconds(a.timeline) == null }];
		}, gated: true,
		description: "Export a timeline JSON to a preset (9:16 1:1 4:5 16:9), thumbnail or gif.",
		shape: { timeline: z.record(z.string(), z.unknown()), preset: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(), format: z.enum(["thumbnail", "gif"]).optional(), loop: z.boolean().optional() },
		run: async ({ timeline, ...rest }, c) => withLinks(await engine("/api/export", { ...timeline, ...rest }), c),
	}),
	t({
		name: "open_in_editor", scope: "editor",
		description: "Return the link that opens an agent-built project (inbox id from POST /api/agent/projects) in the CUT editor. The user must be signed in to the DGDH Suite.",
		shape: { project_id: z.uuid() },
		run: async ({ project_id }, ctx) => {
			const p = await getProject(project_id, { org: ctx.key.org, via: "key" });
			if (!p || p === "forbidden") throw new ToolError("unknown project_id");
			const base = (process.env.CUT_APP_URL || ctx.origin).replace(/\/$/, "");
			return { ok: true, url: `${base}/agent?id=${project_id}` };
		},
	}),
	t({
		name: "estimate", scope: "media:read",
		description: "Price preview without executing: pass the tool name + its arguments, get billable units and EUR (pricing.json, concept prices) plus your remaining budget. Same as calling any tool with dry_run=true.",
		shape: { tool: z.string(), args: z.record(z.string(), z.unknown()).optional() },
		run: async () => { throw new ToolError("estimate is handled by the dispatcher"); },
	}),
	t({
		name: "accept_export", scope: "render", selfMetered: true,
		description: "Settle a render: accepted=true confirms and bills it; accepted=false voids it (EUR 0). Renders are billed only when accepted; unresolved renders auto-accept after 24 h. Use usage.event_id from the render result.",
		shape: { usage_event_id: z.uuid(), accepted: z.boolean().default(true) },
		run: async ({ usage_event_id, accepted }, ctx) => {
			const store = getStore();
			const target = await store.getUsage(usage_event_id);
			if (!target || target.org !== ctx.key.org) throw new ToolError("unknown usage_event_id");
			if (target.state !== "pending") throw new ToolError("this usage event is not a pending render (nothing to accept)");
			const events = await store.listUsage({ keyId: target.key_id }, target.ts);
			const cur = effective(events).find((e) => e.id === target.id);
			if (!cur || cur.eff !== "pending") throw new ToolError(`already ${cur?.eff ?? "resolved"}; cannot change`);
			const state = accepted ? "accepted" : "voided";
			await store.appendUsage({ id: randomUUID(), key_id: ctx.key.id, org: ctx.key.org, tool: "accept_export", units: 0, eur: 0, unit: null, state, ref: target.id, ts: new Date().toISOString(), status: "ok", ms: 0, channel: ctx.channel });
			return { usage_event_id, state, billed_eur: accepted ? target.eur : 0, billed_units: accepted ? target.units : 0, auto_accept_window_h: AUTO_ACCEPT_MS / 3600e3 };
		},
	}),
	t({
		name: "list_projects", scope: "editor",
		description: "List your server-side agent projects (id, name, duration, revision).",
		shape: {},
		run: async (_a, ctx) => ({ projects: await listProjects({ org: ctx.key.org, via: "key" }) }),
	}),
	t({
		name: "get_project", scope: "editor",
		description: "Summary of an agent project: tracks and elements with ids and times in seconds (use these ids in edit_timeline). full=true returns the raw project JSON.",
		shape: { project_id: z.uuid(), full: z.boolean().optional() },
		run: async ({ project_id, full }, ctx) => {
			const p = await getProject(project_id, { org: ctx.key.org, via: "key" });
			if (!p || p === "forbidden") throw new ToolError("unknown project_id");
			return full ? { project: p } : { project: summarize(p) };
		},
	}),
	t({
		name: "edit_timeline", scope: "editor",
		description: "Edit an agent project with structured operations (atomic, all or nothing). ops: trim{element_id,in?,out?,ripple?} (source seconds) · cut{element_id,at} (timeline seconds) · ripple_delete{element_id} · add_clip{file,start?,in?,out?} · add_text{text,start,end} · set_volume{element_id,volume_db}. Get element ids from get_project. Pass expected_revision to avoid overwriting concurrent edits. The browser copy is replaced on next import at /agent?id=<project_id>.",
		shape: { project_id: z.uuid(), operations: z.array(OpSchema).min(1).max(100), expected_revision: z.number().int().optional() },
		run: async ({ project_id, operations, expected_revision }, ctx) => {
			const cur = await getProject(project_id, { org: ctx.key.org, via: "key" });
			if (!cur || cur === "forbidden") throw new ToolError("unknown project_id");
			const rev = cur.revision ?? 1;
			if (expected_revision != null && expected_revision !== rev) throw new ToolError(`revision conflict: project is at revision ${rev}, you expected ${expected_revision}`);
			let bin: any[] | null = null;
			const mediaInfo = async (file: string) => { bin ??= (await engine("/api/media-bin")).items; return bin!.find((i) => i.file === file) ?? null; };
			let res;
			try { res = await applyOps(cur, operations, mediaInfo); }
			catch (e) { throw new ToolError(e instanceof Error ? e.message : "edit failed"); }
			const saved = await updateProject(res.payload as any, rev);
			if (saved === "conflict") throw new ToolError("revision conflict: project changed during the edit, retry");
			return { applied: res.log, project: summarize(saved) };
		},
	}),
	t({
		name: "detect_scenes", scope: "render",
		description: "Detect shot/scene cuts in a media-bin video (ffmpeg scene score) and propose chapters. Returns scenes [{start,end}] and chapters. Free (analysis).",
		shape: { file, threshold: z.number().min(0.05).max(0.9).optional(), min_scene: z.number().min(0.1).optional(), chapter_min_len: z.number().min(1).optional(), titles: z.array(z.string()).optional() },
		run: async (a) => engine("/api/scenes", a),
	}),
	t({
		name: "measure_loudness", scope: "render",
		description: "Measure integrated loudness (LUFS) of a clip against a target (default -14 LUFS). The engine has no measure-only endpoint, so this runs an audio-only EBU R128 pass and discards the output file; no render result is returned. Free (analysis).",
		shape: { file, target_lufs: z.number().min(-40).max(-5).optional() },
		run: async ({ file, target_lufs }) => {
			const r = await engine("/api/loudness", { file, audio_only: true, ...(target_lufs != null ? { target_lufs } : {}) });
			return { file, input_lufs: r.input_lufs, target_lufs: r.target_lufs, gain_needed_db: r.input_lufs == null ? null : +(r.target_lufs - r.input_lufs).toFixed(2) };
		},
	}),
	t({
		name: "normalize_loudness", scope: "render",
		description: "Normalise loudness (two-pass EBU R128, default -14 LUFS / -1.5 dBTP) into a new media-bin file; set audio_only for an m4a. Billed on acceptance like other renders.",
		shape: { file, target_lufs: z.number().min(-40).max(-5).optional(), true_peak_db: z.number().min(-9).max(0).optional(), lra: z.number().min(1).max(50).optional(), audio_only: z.boolean().optional() },
		price: renderPrice(), gated: true,
		run: async (a, c) => withLinks(await engine("/api/loudness", a), c),
	}),
	t({
		name: "publish_to_social", scope: "publish",
		description: "Send a media-bin export to DGDH SOCIAL as a DRAFT (concept). Never publishes or schedules; a human approves in the SOCIAL app. Needs the engine's SOCIAL_API_* and CUT_PUBLIC_URL configured, else a clear error is returned.",
		shape: { file, platform: z.string().min(1).max(40), text: z.string().max(2200).optional(), tenant_slug: z.string().regex(/^[\w-]+$/).optional() },
		run: async ({ file, platform, text, tenant_slug }) => {
			const r = await engine("/api/auto-reel/publish", { file, platform, text, ...(tenant_slug ? { tenantSlug: tenant_slug } : {}) });
			return { ...r, draft_only: true };
		},
	}),
];

export const toolByName = (n: string) => TOOLS.find((x) => x.name === n);
