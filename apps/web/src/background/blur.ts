export const BACKGROUND_BLUR_INTENSITY_PRESETS: Array<{
	label: string;
	value: number;
}> = [
	{ label: "Licht", value: 100 },
	{ label: "Gemiddeld", value: 200 },
	{ label: "Sterk", value: 500 },
] as const;

export const DEFAULT_BACKGROUND_BLUR_INTENSITY = 10;
