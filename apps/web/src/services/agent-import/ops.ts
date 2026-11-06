// Server-safe timeline operations on a "dgdh-cut-agent-project/v1" payload. No browser imports:
// used by the edit_timeline MCP/REST tool. Times in the API are seconds; the project stores ticks (1/120000 s).
import { z } from "zod";

export const TICKS_PER_SECOND = 120_000;
export const AGENT_SCHEMA = "dgdh-cut-agent-project/v1";
const VOLUME_DB_MIN = -60; // keep in sync with timeline/audio-constants.ts
const VOLUME_DB_MAX = 20;
const tk = (s: number) => Math.round(s * TICKS_PER_SECOND);
const EPS = 0.01;

export const OpSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("trim"), element_id: z.string(), in: z.number().min(0).optional().describe("new source in-point (s)"), out: z.number().min(0).optional().describe("new source out-point (s)"), ripple: z.boolean().optional().describe("shift later elements on the same track by the removed time") }),
	z.object({ op: z.literal("cut"), element_id: z.string(), at: z.number().min(0).describe("timeline time (s) to split at") }),
	z.object({ op: z.literal("ripple_delete"), element_id: z.string() }),
	z.object({ op: z.literal("add_clip"), file: z.string().regex(/^[\w.-]+$/).describe("media-bin file name"), start: z.number().min(0).optional().describe("timeline start (s), default end of main track"), in: z.number().min(0).optional(), out: z.number().min(0).optional() }),
	z.object({ op: z.literal("add_text"), text: z.string().min(1).max(500), start: z.number().min(0), end: z.number().min(0) }),
	z.object({ op: z.literal("set_volume"), element_id: z.string(), volume_db: z.number().describe(`dB, ${VOLUME_DB_MIN}..${VOLUME_DB_MAX}; 0 = unchanged`) }),
]);
export type Op = z.infer<typeof OpSchema>;
export class OpError extends Error {}

type El = Record<string, any>;
type Payload = Record<string, any>;
export type MediaInfo = (file: string) => Promise<{ duration_s?: number | null; kind?: string } | null>;

const sceneOf = (p: Payload) => {
	const scenes = p.project.scenes as any[];
	return scenes.find((s) => s.id === p.project.currentSceneId) ?? scenes[0];
};
const tracksOf = (scene: any): { name: string; kind: "main" | "overlay" | "audio"; els: El[] }[] => [
	{ name: scene.tracks.main.name ?? "Main", kind: "main", els: scene.tracks.main.elements },
	...scene.tracks.overlay.map((t: any) => ({ name: t.name, kind: "overlay" as const, els: t.elements })),
	...scene.tracks.audio.map((t: any) => ({ name: t.name, kind: "audio" as const, els: t.elements })),
];
function locate(scene: any, id: string) {
	for (const t of tracksOf(scene)) {
		const i = t.els.findIndex((e) => e.id === id);
		if (i >= 0) return { track: t, index: i, el: t.els[i] };
	}
	throw new OpError(`unknown element_id ${id}`);
}
const end = (e: El) => Number(e.startTime) + Number(e.duration);

export async function applyOps(input: Payload, ops: Op[], mediaInfo: MediaInfo): Promise<{ payload: Payload; log: string[] }> {
	if (input?.schema !== AGENT_SCHEMA) throw new OpError("not an agent project");
	const p: Payload = structuredClone(input);
	const scene = sceneOf(p);
	const log: string[] = [];
	for (const [n, op] of ops.entries()) {
		const tag = `op ${n + 1} (${op.op})`;
		try {
			switch (op.op) {
				case "trim": {
					const { el, track, index } = locate(scene, op.element_id);
					if (el.sourceDuration == null) throw new OpError("element has no source media to trim");
					const curIn = el.trimStart / TICKS_PER_SECOND, curOut = curIn + el.duration / TICKS_PER_SECOND;
					const full = el.sourceDuration / TICKS_PER_SECOND;
					const nin = op.in ?? curIn, nout = op.out ?? curOut;
					if (!(nout - nin > EPS)) throw new OpError("out must be greater than in");
					if (nout > full + EPS) throw new OpError(`out ${nout}s exceeds source length ${full.toFixed(2)}s`);
					const oldDur = el.duration;
					el.trimStart = tk(nin);
					el.duration = tk(nout - nin);
					el.trimEnd = Math.max(0, el.sourceDuration - tk(nout));
					const delta = oldDur - el.duration;
					if (op.ripple && delta > 0) for (const o of track.els) if (o !== el && o.startTime >= el.startTime + oldDur - 1) o.startTime -= delta;
					void index;
					log.push(`${tag}: ${op.element_id} now ${nin}s..${nout}s`);
					break;
				}
				case "cut": {
					const { el, track, index } = locate(scene, op.element_id);
					const s0 = el.startTime / TICKS_PER_SECOND, s1 = end(el) / TICKS_PER_SECOND;
					if (!(op.at > s0 + EPS && op.at < s1 - EPS)) throw new OpError(`cut point ${op.at}s must be inside ${s0.toFixed(2)}s..${s1.toFixed(2)}s`);
					const firstDur = tk(op.at) - el.startTime, restDur = el.duration - firstDur;
					const second: El = { ...structuredClone(el), id: crypto.randomUUID(), startTime: el.startTime + firstDur, duration: restDur, trimStart: (el.trimStart ?? 0) + firstDur };
					el.trimEnd = (el.trimEnd ?? 0) + restDur;
					el.duration = firstDur;
					track.els.splice(index + 1, 0, second);
					log.push(`${tag}: ${op.element_id} split at ${op.at}s -> ${second.id}`);
					break;
				}
				case "ripple_delete": {
					const { el, track, index } = locate(scene, op.element_id);
					const e1 = end(el), dur = el.duration;
					track.els.splice(index, 1);
					for (const t of tracksOf(scene)) for (const o of t.els) if (o.startTime >= e1 - 1) o.startTime -= dur;
					log.push(`${tag}: removed ${op.element_id} (${(dur / TICKS_PER_SECOND).toFixed(2)}s), later elements shifted left`);
					break;
				}
				case "add_clip": {
					const info = await mediaInfo(op.file);
					if (!info) throw new OpError(`media-bin has no ${op.file}`);
					const isImage = info.kind === "image" || /\.(jpe?g|png|webp|heic)$/i.test(op.file);
					const full = info.duration_s ?? (isImage ? 5 : null);
					if (full == null) throw new OpError(`cannot determine duration of ${op.file}`);
					const nin = op.in ?? 0, nout = op.out ?? full;
					if (!(nout - nin > EPS) || (!isImage && nout > full + EPS)) throw new OpError(`invalid in/out for ${op.file} (length ${full}s)`);
					const main = scene.tracks.main.elements as El[];
					const start = tk(op.start ?? (main.length ? Math.max(...main.map(end)) / TICKS_PER_SECOND : 0));
					const dur = tk(nout - nin);
					if (main.some((o) => start < end(o) - 1 && start + dur > o.startTime + 1)) throw new OpError("clip overlaps an existing main-track clip; use ripple_delete/trim first or pick another start");
					let m = (p.media as any[]).find((x) => x.file === op.file);
					if (!m) {
						m = { id: crypto.randomUUID(), file: op.file, role: "source", name: op.file, type: isImage ? "image" : "video", url: `/api/engine/media/${op.file}`, duration_s: info.duration_s ?? undefined };
						p.media.push(m);
					}
					const el: El = { id: crypto.randomUUID(), type: m.type, mediaId: m.id, name: op.file, startTime: start, duration: dur, trimStart: tk(nin), trimEnd: Math.max(0, tk(full) - tk(nout)), sourceDuration: tk(full), isSourceAudioEnabled: true, hidden: false, params: {} };
					main.push(el);
					main.sort((a, b) => a.startTime - b.startTime);
					log.push(`${tag}: added ${op.file} at ${(start / TICKS_PER_SECOND).toFixed(2)}s as ${el.id}`);
					break;
				}
				case "add_text": {
					if (!(op.end - op.start > EPS)) throw new OpError("end must be greater than start");
					let tr = (scene.tracks.overlay as any[]).find((t) => t.type === "text");
					if (!tr) { tr = { id: crypto.randomUUID(), name: "Captions", type: "text", hidden: false, elements: [] }; scene.tracks.overlay.push(tr); }
					const el: El = { id: crypto.randomUUID(), type: "text", name: op.text.slice(0, 24), startTime: tk(op.start), duration: tk(op.end - op.start), trimStart: 0, trimEnd: 0, params: { content: op.text, fontSize: 12 } };
					tr.elements.push(el);
					log.push(`${tag}: text "${op.text.slice(0, 24)}" ${op.start}s..${op.end}s as ${el.id}`);
					break;
				}
				case "set_volume": {
					const { el } = locate(scene, op.element_id);
					if (el.type !== "audio" && el.type !== "video") throw new OpError("volume applies to audio and video elements only");
					el.params = { ...(el.params ?? {}), volume: Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, op.volume_db)) };
					log.push(`${tag}: ${op.element_id} volume ${el.params.volume} dB`);
					break;
				}
			}
		} catch (e) {
			if (e instanceof OpError) throw new OpError(`${tag} failed: ${e.message} (no changes saved)`);
			throw e;
		}
	}
	const all = tracksOf(scene).flatMap((t) => t.els);
	p.project.metadata.duration = all.length ? Math.max(...all.map(end)) : 0;
	p.project.metadata.updatedAt = new Date().toISOString();
	scene.updatedAt = p.project.metadata.updatedAt;
	return { payload: p, log };
}

/** Summary an agent can reason about without the full JSON (ids, times in seconds). */
export function summarize(p: Payload) {
	const scene = sceneOf(p);
	const s = (n: number) => +(n / TICKS_PER_SECOND).toFixed(3);
	return {
		id: p.project.metadata.id, name: p.project.metadata.name, revision: p.revision ?? 1, duration_s: s(p.project.metadata.duration),
		canvas: p.project.settings?.canvasSize, media: (p.media ?? []).map((m: any) => ({ file: m.file, role: m.role, type: m.type, duration_s: m.duration_s })),
		tracks: tracksOf(scene).map((t) => ({ name: t.name, kind: t.kind, elements: t.els.map((e) => ({ id: e.id, type: e.type, name: e.name, start_s: s(e.startTime), duration_s: s(e.duration), ...(e.sourceDuration != null ? { in_s: s(e.trimStart), out_s: s(e.trimStart + e.duration) } : {}), ...(e.params?.content ? { text: e.params.content } : {}), ...(e.params?.volume != null ? { volume_db: e.params.volume } : {}) })) })),
	};
}
