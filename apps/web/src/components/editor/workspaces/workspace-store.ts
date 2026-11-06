import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import {
	DEFAULT_WORKSPACE,
	WORKSPACE_PRESETS,
	getPreset,
	isWorkspaceId,
	type WorkspaceId,
	type WorkspaceSizes,
} from "./presets";

type SizesByWorkspace = Record<WorkspaceId, WorkspaceSizes>;

function defaultSizes(): SizesByWorkspace {
	return Object.fromEntries(
		WORKSPACE_PRESETS.map((p) => [p.id, { ...p.sizes }]),
	) as SizesByWorkspace;
}

interface WorkspaceState {
	active: WorkspaceId;
	sizes: SizesByWorkspace;
	setActive: (id: WorkspaceId) => void;
	setSize: (args: {
		id: WorkspaceId;
		key: keyof WorkspaceSizes;
		size: number;
	}) => void;
	resetActive: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
	persist(
		(set, get) => ({
			active: DEFAULT_WORKSPACE,
			sizes: defaultSizes(),
			setActive: (id) => {
				set({ active: id });
				useAssetsPanelStore.getState().setActiveTab(getPreset(id).assetsTab);
			},
			setSize: ({ id, key, size }) =>
				set((state) => ({
					sizes: {
						...state.sizes,
						[id]: { ...state.sizes[id], [key]: size },
					},
				})),
			resetActive: () => {
				const id = get().active;
				set((state) => ({
					sizes: { ...state.sizes, [id]: { ...getPreset(id).sizes } },
				}));
			},
		}),
		{
			name: "dgdh-cut-workspaces",
			version: 1,
			partialize: (state) => ({ active: state.active, sizes: state.sizes }),
			merge: (persisted, current) => {
				const p = persisted as Partial<WorkspaceState> | undefined;
				const sizes = defaultSizes();
				for (const id of Object.keys(sizes) as WorkspaceId[]) {
					sizes[id] = { ...sizes[id], ...(p?.sizes?.[id] ?? {}) };
				}
				return {
					...current,
					active: isWorkspaceId(p?.active) ? p.active : current.active,
					sizes,
				};
			},
		},
	),
);
