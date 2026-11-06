import { create } from "zustand";
import type { TranscriptLanguage, TranscriptWord } from "./types";
import { DEFAULT_TRANSCRIPT_LANGUAGE } from "./types";

interface TranscriptState {
	words: TranscriptWord[];
	language: TranscriptLanguage;
	selectedIds: string[];
	setWords: (args: { words: TranscriptWord[] }) => void;
	setLanguage: (args: { language: TranscriptLanguage }) => void;
	setSelection: (args: { ids: string[] }) => void;
}

export const useTranscriptStore = create<TranscriptState>((set) => ({
	words: [],
	language: DEFAULT_TRANSCRIPT_LANGUAGE,
	selectedIds: [],
	setWords: ({ words }) => set({ words, selectedIds: [] }),
	setLanguage: ({ language }) => set({ language }),
	setSelection: ({ ids }) => set({ selectedIds: ids }),
}));
