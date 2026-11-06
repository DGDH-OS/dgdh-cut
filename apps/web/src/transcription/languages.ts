export const LANGUAGES = [
	{ code: "en", name: "Engels" },
	{ code: "es", name: "Spaans" },
	{ code: "it", name: "Italiaans" },
	{ code: "fr", name: "Frans" },
	{ code: "de", name: "Duits" },
	{ code: "pt", name: "Portugees" },
	{ code: "ru", name: "Russisch" },
	{ code: "ja", name: "Japans" },
	{ code: "zh", name: "Chinees" },
] as const;

export type Language = (typeof LANGUAGES)[number];
export type LanguageCode = Language["code"];
