import { create } from "zustand";

/**
 * Solo is UI-only state layered on the existing per-track `muted` flag:
 * while any track is soloed, every other audio track is muted through the
 * normal toggle-mute command; the pre-solo mute state is restored afterwards.
 */
interface MixerState {
	soloIds: string[];
	baselineMuted: Record<string, boolean>;
	engageSolo: (args: {
		trackId: string;
		currentMuted: Record<string, boolean>;
	}) => { soloIds: string[]; baseline: Record<string, boolean> };
	reset: () => void;
}

export const useMixerStore = create<MixerState>()((set, get) => ({
	soloIds: [],
	baselineMuted: {},
	engageSolo: ({ trackId, currentMuted }) => {
		const prev = get();
		const baseline =
			prev.soloIds.length === 0 ? { ...currentMuted } : prev.baselineMuted;
		const soloIds = prev.soloIds.includes(trackId)
			? prev.soloIds.filter((id) => id !== trackId)
			: [...prev.soloIds, trackId];
		set({ soloIds, baselineMuted: soloIds.length === 0 ? {} : baseline });
		return { soloIds, baseline };
	},
	reset: () => set({ soloIds: [], baselineMuted: {} }),
}));
