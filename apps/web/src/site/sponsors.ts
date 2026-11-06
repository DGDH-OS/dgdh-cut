export type Sponsor = {
	name: string;
	url: string;
	logo: string;
	description: string;
	invertOnDark?: boolean;
};

export const SPONSORS: Sponsor[] = [
	{
		name: "Fal.ai",
		url: "https://fal.ai?utm_source=opencut",
		logo: "/logos/others/fal.svg",
		description: "Generatieve beeld-, video- en audiomodellen op één plek.",
		invertOnDark: true,
	},
	{
		name: "Vercel",
		url: "https://vercel.com?utm_source=opencut",
		logo: "/logos/others/vercel.svg",
		description: "Platform waarop we DGDH CUT deployen en hosten.",
		invertOnDark: true,
	},
];
