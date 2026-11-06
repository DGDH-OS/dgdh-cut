import type { Tab } from "@/components/editor/panels/assets/assets-panel-store";

export type WorkspaceId = "editing" | "color" | "audio" | "captions";
export type SidePanelKind = "properties" | "mixer";

export interface WorkspaceSizes {
	tools: number;
	preview: number;
	side: number;
	mainContent: number;
	timeline: number;
}

export interface WorkspacePreset {
	id: WorkspaceId;
	label: string;
	description: string;
	assetsTab: Tab;
	side: SidePanelKind;
	sizes: WorkspaceSizes;
}

export const WORKSPACE_PRESETS: readonly WorkspacePreset[] = [
	{
		id: "editing",
		label: "Editing",
		description: "Media, preview and properties",
		assetsTab: "media",
		side: "properties",
		sizes: { tools: 25, preview: 50, side: 25, mainContent: 55, timeline: 45 },
	},
	{
		id: "color",
		label: "Color",
		description: "Grade tools with a large program monitor",
		assetsTab: "adjustment",
		side: "properties",
		sizes: { tools: 28, preview: 47, side: 25, mainContent: 68, timeline: 32 },
	},
	{
		id: "audio",
		label: "Audio",
		description: "Sounds and the audio mixer",
		assetsTab: "sounds",
		side: "mixer",
		sizes: { tools: 22, preview: 40, side: 38, mainContent: 45, timeline: 55 },
	},
	{
		id: "captions",
		label: "Captions",
		description: "Caption tools with a large program monitor",
		assetsTab: "captions",
		side: "properties",
		sizes: { tools: 30, preview: 45, side: 25, mainContent: 62, timeline: 38 },
	},
] as const;

export const DEFAULT_WORKSPACE: WorkspaceId = "editing";

export function getPreset(id: WorkspaceId): WorkspacePreset {
	return WORKSPACE_PRESETS.find((p) => p.id === id) ?? WORKSPACE_PRESETS[0];
}

export function isWorkspaceId(value: unknown): value is WorkspaceId {
	return WORKSPACE_PRESETS.some((p) => p.id === value);
}
