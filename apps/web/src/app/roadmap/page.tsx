import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import { GitHubContributeSection } from "@/components/gitHub-contribute-section";
import { Badge } from "@/components/ui/badge";
import { ReactMarkdownWrapper } from "@/components/ui/react-markdown-wrapper";
import { cn } from "@/utils/ui";

const LAST_UPDATED = "25 februari 2026";

type StatusType = "complete" | "pending" | "default" | "info";

interface Status {
	text: string;
	type: StatusType;
}

interface RoadmapItem {
	title: string;
	description: string;
	status: Status;
}

const roadmapItems: RoadmapItem[] = [
	{
		title: "Start",
		description:
			"Hier begon het allemaal. Repository aangemaakt, eerste projectstructuur en de visie voor een gratis, open-source videobewerker. [Bekijk de eerste tweet](https://x.com/mazeincoding/status/1936706642512388188) om te zien waar het begon.",
		status: {
			text: "Voltooid",
			type: "complete",
		},
	},
	{
		title: "Basis-UI",
		description:
			"De basis bouwen: hoofdlayout, header, zijbalk, tijdlijncontainer en basiscomponenten. Nog niet alle functionaliteit, maar het UI-raamwerk waar al het andere op voortbouwt.",
		status: {
			text: "Voltooid",
			type: "complete",
		},
	},
	{
		title: "Essentiële functionaliteit",
		description:
			"Alles wat een videobewerker **bruikbaar** maakt. Interactiviteit van de tijdlijn, opslag, effecten, overgangen, enzovoort.",
		status: {
			text: "Bezig",
			type: "pending",
		},
	},
	{
		title: "Native app (mobiel/desktop)",
		description:
			"Native DGDH CUT-apps voor Mac, Windows, Linux en iOS/Android.",
		status: {
			text: "Niet gestart",
			type: "default",
		},
	},
];

export const metadata: Metadata = {
	title: "Roadmap - DGDH CUT",
	description:
		"Bekijk wat er straks komt voor DGDH CUT, de videobewerker in je browser voor korte video.",
	openGraph: {
		title: "DGDH CUT roadmap: wat er straks komt",
		description:
			"Bekijk wat er straks komt voor DGDH CUT, de videobewerker in je browser voor korte video.",
		type: "website",
		images: [
			{
				url: "/open-graph/roadmap.jpg",
				width: 1200,
				height: 630,
				alt: "DGDH CUT roadmap",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "DGDH CUT roadmap: wat er straks komt",
		description:
			"Bekijk wat er straks komt voor DGDH CUT, de videobewerker in je browser voor korte video.",
		images: ["/open-graph/roadmap.jpg"],
	},
};

export default function RoadmapPage() {
	return (
		<BasePage
			title="Roadmap"
			description={`Wat er straks komt voor DGDH CUT (laatst bijgewerkt: ${LAST_UPDATED})`}
		>
			<div className="mx-auto flex max-w-4xl flex-col gap-16">
				<div className="flex flex-col gap-6">
					{roadmapItems.map((item, index) => (
						<RoadmapItem key={item.title} item={item} index={index} />
					))}
				</div>
				<GitHubContributeSection
					title="Wil je helpen?"
					description="DGDH CUT is open source en wordt door de community gebouwd. Elke bijdrage, hoe klein ook, helpt ons de best mogelijke gratis videobewerker te bouwen."
				/>
			</div>
		</BasePage>
	);
}

function RoadmapItem({ item, index }: { item: RoadmapItem; index: number }) {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-medium">
				<span className="leading-normal select-none">{index + 1}</span>
				<h3>{item.title}</h3>
				<StatusBadge status={item.status} className="ml-1" />
			</div>
			<div className="text-foreground/70 leading-relaxed">
				<ReactMarkdownWrapper>{item.description}</ReactMarkdownWrapper>
			</div>
		</div>
	);
}

function StatusBadge({
	status,
	className,
}: {
	status: Status;
	className?: string;
}) {
	return (
		<Badge
			className={cn("shadow-none", className, {
				"bg-constructive! text-primary-foreground": status.type === "complete",
				"bg-bronze! text-foreground": status.type === "pending",
				"bg-muted! text-foreground": status.type === "info",
				"bg-foreground/10! text-accent-foreground": status.type === "default",
			})}
		>
			{status.text}
		</Badge>
	);
}
