import { OcDataBuddyIcon, OcMarbleIcon } from "@/components/icons";

export type ExternalTool = {
	name: string;
	description: string;
	url: string;
	icon: React.ElementType;
};

export const EXTERNAL_TOOLS: ExternalTool[] = [
	{
		name: "Marble",
		description:
			"Modern headless CMS voor contentbeheer en de blog van DGDH CUT",
		url: "https://marblecms.com?utm_source=opencut",
		icon: OcMarbleIcon,
	},
	{
		name: "Databuddy",
		description: "AVG-conforme analytics en gebruikersinzichten voor DGDH CUT",
		url: "https://databuddy.cc?utm_source=opencut",
		icon: OcDataBuddyIcon,
	},
];
