/** Eén woord in het transcript, tijden in seconden op de tijdlijn. */
export interface TranscriptWord {
	id: string;
	text: string;
	start: number;
	end: number;
}

export interface TimeRange {
	start: number;
	end: number;
}

export const TRANSCRIPT_LANGUAGES = [
	{ code: "nl", name: "Nederlands" },
	{ code: "en", name: "Engels" },
	{ code: "de", name: "Duits" },
	{ code: "fr", name: "Frans" },
	{ code: "es", name: "Spaans" },
	{ code: "it", name: "Italiaans" },
	{ code: "pt", name: "Portugees" },
] as const;

export type TranscriptLanguage = (typeof TRANSCRIPT_LANGUAGES)[number]["code"];
export const DEFAULT_TRANSCRIPT_LANGUAGE: TranscriptLanguage = "nl";
