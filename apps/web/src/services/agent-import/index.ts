import type { MediaAsset } from "@/media/types";
import type { SerializedProject } from "@/services/storage/types";
import { storageService } from "@/services/storage/service";
import type { TProject } from "@/project/types";
import type { TScene, TimelineElement } from "@/timeline";
import {
	buildElementFromMedia,
	buildLibraryAudioElement,
	buildTextElement,
} from "@/timeline/element-utils";
import { mediaTime } from "@/wasm";

export const AGENT_SCHEMA = "dgdh-cut-agent-project/v1";

export type AgentMediaRef = {
	id: string;
	file: string;
	role: "source" | "render";
	name: string;
	type: "video" | "image" | "audio";
	url: string; // same-origin engine proxy, e.g. /api/engine/media/a.mp4
	duration_s?: number;
};

export type AgentPayload = {
	schema: typeof AGENT_SCHEMA;
	project: SerializedProject;
	media: AgentMediaRef[];
	engine?: { render?: { file: string; preview: string } };
};

function probeVideo(url: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const v = document.createElement("video");
		v.preload = "metadata";
		v.muted = true;
		v.onloadedmetadata = () =>
			resolve({ width: v.videoWidth, height: v.videoHeight });
		v.onerror = () => resolve({ width: 0, height: 0 });
		v.src = url;
	});
}

/** Fill sparse agent elements with the editor's own default params. */
function hydrateElement(el: Record<string, unknown>): TimelineElement {
	const t = (n: unknown) => mediaTime({ ticks: Math.round(Number(n) || 0) });
	const base = {
		name: String(el.name ?? ""),
		duration: t(el.duration),
		startTime: t(el.startTime),
	};
	const given = (el.params ?? {}) as Record<string, never>;
	let built: Record<string, unknown>;
	if (el.type === "text") {
		built = buildTextElement({
			raw: { name: base.name, duration: base.duration, params: given },
			startTime: base.startTime,
		}) as Record<string, unknown>;
	} else if (el.type === "audio" && el.sourceType === "library") {
		built = buildLibraryAudioElement({
			sourceUrl: String(el.sourceUrl),
			...base,
		}) as Record<string, unknown>;
		built.params = { ...(built.params as object), ...given };
	} else {
		built = buildElementFromMedia({
			mediaId: String(el.mediaId),
			mediaType: el.type as "video" | "image" | "audio",
			...base,
		}) as Record<string, unknown>;
		built.params = { ...(built.params as object), ...given };
	}
	return {
		...built,
		id: String(el.id),
		trimStart: t(el.trimStart),
		trimEnd: t(el.trimEnd),
		...(el.sourceDuration != null && { sourceDuration: t(el.sourceDuration) }),
	} as TimelineElement;
}

function hydrateScene(scene: SerializedProject["scenes"][number]): TScene {
	const h = (els: unknown[]) =>
		els.map((e) => hydrateElement(e as Record<string, unknown>));
	const tr = scene.tracks as unknown as {
		main: { elements: unknown[] };
		overlay: { elements: unknown[] }[];
		audio: { elements: unknown[] }[];
	};
	return {
		...scene,
		createdAt: new Date(scene.createdAt),
		updatedAt: new Date(scene.updatedAt),
		tracks: {
			...scene.tracks,
			main: { ...tr.main, elements: h(tr.main.elements) },
			overlay: tr.overlay.map((t) => ({ ...t, elements: h(t.elements) })),
			audio: tr.audio.map((t) => ({ ...t, elements: h(t.elements) })),
		},
	} as unknown as TScene;
}

/**
 * Import an agent project into the editor's own IndexedDB/OPFS storage
 * (storageService, unchanged). Idempotent: the project id comes from the
 * agent, so re-importing overwrites the same project.
 */
export async function importAgentProject({
	payload,
	onProgress,
}: {
	payload: AgentPayload;
	onProgress?: (msg: string) => void;
}): Promise<string> {
	if (payload.schema !== AGENT_SCHEMA) throw new Error("unsupported schema");
	const p = payload.project;
	const projectId = p.metadata.id;

	for (const m of payload.media) {
		onProgress?.(`media ${m.file}`);
		const res = await fetch(m.url);
		if (!res.ok) throw new Error(`media ${m.file}: HTTP ${res.status}`);
		const blob = await res.blob();
		const file = new File([blob], m.file, {
			type: blob.type || "video/mp4",
			lastModified: Date.now(),
		});
		const dims =
			m.type === "video"
				? await probeVideo(URL.createObjectURL(file))
				: { width: 0, height: 0 };
		const asset: MediaAsset = {
			id: m.id,
			name: m.name,
			type: m.type,
			file,
			duration: m.duration_s,
			...(dims.width ? dims : {}),
		};
		await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
	}

	onProgress?.("project");
	const project: TProject = {
		metadata: {
			...p.metadata,
			duration: mediaTime({ ticks: Math.round(Number(p.metadata.duration)) }),
			createdAt: new Date(p.metadata.createdAt),
			updatedAt: new Date(p.metadata.updatedAt),
		},
		scenes: p.scenes.map(hydrateScene),
		currentSceneId: p.currentSceneId,
		settings: p.settings,
		version: p.version,
		timelineViewState: p.timelineViewState,
	};
	await storageService.saveProject({ project });
	return projectId;
}
