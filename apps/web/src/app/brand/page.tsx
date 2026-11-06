"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { BasePage } from "@/app/base-page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/ui";

function downloadAsset(src: string) {
	const filename = src.split("/").pop() ?? "asset.svg";
	const a = document.createElement("a");
	a.href = src;
	a.download = filename;
	a.click();
}

async function copyAsset(src: string) {
	const res = await fetch(src);
	const text = await res.text();
	await navigator.clipboard.writeText(text);
}

const ALL_ASSETS = () => ASSET_SECTIONS.flatMap((s) => s.assets);

type AssetTheme = "dark" | "light" | "icon";

interface AssetVariant {
	src: string;
	theme: AssetTheme;
	label: string;
	width: number;
	height: number;
}

interface AssetSection {
	title: string;
	description: string;
	cols: "1" | "2";
	assets: AssetVariant[];
}

const ASSET_SECTIONS: AssetSection[] = [
	{
		title: "Symbol",
		description:
			"Use the symbol on its own when the DGDH CUT name is already present nearby or space is limited.",
		cols: "2",
		assets: [
			{
				src: "/logos/dgdh-cut/symbol.svg",
				theme: "dark",
				label: "Symbol",
				width: 400,
				height: 400,
			},
			{
				src: "/logos/dgdh-cut/symbol-light.svg",
				theme: "light",
				label: "Symbol",
				width: 400,
				height: 400,
			},
		],
	},
	{
		title: "Lockup",
		description:
			"The full lockup combines the symbol and wordmark. Prefer this in most contexts where you have enough horizontal space.",
		cols: "2",
		assets: [
			{
				src: "/logos/dgdh-cut/logo.svg",
				theme: "dark",
				label: "Logo",
				width: 1809,
				height: 400,
			},
			{
				src: "/logos/dgdh-cut/logo-light.svg",
				theme: "light",
				label: "Logo",
				width: 1809,
				height: 400,
			},
			{
				src: "/logos/dgdh-cut/text.svg",
				theme: "dark",
				label: "Text",
				width: 1760,
				height: 400,
			},
			{
				src: "/logos/dgdh-cut/text-light.svg",
				theme: "light",
				label: "Text",
				width: 1760,
				height: 400,
			},
		],
	},
];

export default function BrandPage() {
	return (
		<BasePage
			maxWidth="6xl"
			title="Brand"
			description={
				<>
					Download DGDH CUT brand assets for use in your projects.{" "}
					<Link
						href="#guidelines"
						className="underline underline-offset-4"
						onClick={() =>
							document
								.getElementById("guidelines")
								?.scrollIntoView({ behavior: "smooth" })
						}
					>
						Read the brand guidelines.
					</Link>
				</>
			}
			action={
				<Button
					variant="outline"
					size="lg"
					className="mx-auto gap-2"
					onClick={() => {
						ALL_ASSETS().forEach((asset, i) => {
							setTimeout(() => downloadAsset(asset.src), i * 200);
						});
					}}
				>
					<Download />
					Download all
				</Button>
			}
		>
			<div className="flex flex-col gap-10">
				{ASSET_SECTIONS.map((section) => (
					<div key={section.title} className="flex flex-col gap-4">
						<div className="flex flex-col gap-1">
							<h2 className="font-semibold text-lg">{section.title}</h2>
							<p className="text-muted-foreground text-sm">
								{section.description}
							</p>
						</div>
						<div
							className={cn(
								"grid gap-3",
								section.cols === "2"
									? "grid-cols-1 sm:grid-cols-2"
									: "grid-cols-1",
							)}
						>
							{section.assets.map((variant) => (
								<AssetCard key={variant.src} variant={variant} />
							))}
						</div>
					</div>
				))}
			</div>

			<Separator />

			<div id="guidelines" className="flex flex-col gap-8 text-sm">
				<div className="flex flex-col gap-3">
					<h2 className="font-semibold text-lg">Usage</h2>
					<p className="text-muted-foreground text-base leading-relaxed">
						DGDH CUT is open source — the code is free to use under its license.
						That license does not cover the name or logo. You can say you use
						DGDH CUT, that your project integrates with DGDH CUT, or that it was
						built on top of DGDH CUT. You cannot name your product DGDH CUT, imply
						we made or endorse your product, or use the marks commercially
						without asking first. For anything unclear, reach out at{" "}
						<Link
							href="mailto:brand@opencut.app"
							className="underline underline-offset-4"
						>
							brand@opencut.app
						</Link>
						.
					</p>
				</div>

				<div className="flex flex-col gap-3">
					<h2 className="font-semibold text-lg">What&apos;s not allowed</h2>
					<ul className="text-muted-foreground text-base flex flex-col gap-2 leading-relaxed">
						{[
							"Using DGDH CUT in the name of your product, service, or domain.",
							"Implying that DGDH CUT made, sponsors, or endorses your work.",
							"Using the logo or name on merchandise or commercial marketing.",
							"Modifying the marks.",
						].map((item) => (
							<li key={item} className="flex gap-2">
								<span className="mt-0.5 shrink-0">-</span>
								<span>{item}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</BasePage>
	);
}

const CHECKER_STYLES: Record<"dark" | "light", CSSProperties> = {
	light: {
		backgroundImage:
			"linear-gradient(45deg, #1e232c 25%, transparent 25%), linear-gradient(-45deg, #1e232c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e232c 75%), linear-gradient(-45deg, transparent 75%, #1e232c 75%)",
		backgroundSize: "18px 18px",
		backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
		backgroundColor: "#121212",
	},
	dark: {
		backgroundImage:
			"linear-gradient(45deg, #e6e5e1 25%, transparent 25%), linear-gradient(-45deg, #e6e5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e6e5e1 75%), linear-gradient(-45deg, transparent 75%, #e6e5e1 75%)",
		backgroundSize: "18px 18px",
		backgroundPosition: "0 0, 0 9px, 9px -9px, -9px 0px",
		backgroundColor: "#f8f7f4",
	},
};

function AssetCard({ variant }: { variant: AssetVariant }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		await copyAsset(variant.src);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Card
			className="group relative overflow-hidden"
			style={
				variant.theme === "icon" ? undefined : CHECKER_STYLES[variant.theme]
			}
		>
			<div className="flex h-56 items-center justify-center px-12 py-8">
				<Image
					src={variant.src}
					alt={variant.label}
					width={variant.width}
					height={variant.height}
					className="max-h-16 w-auto select-none object-contain"
					draggable={false}
					unoptimized
				/>
			</div>

			<Button
				variant="outline"
				size="icon"
				className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 size-9"
				onClick={handleCopy}
			>
				{copied ? <Check /> : <Copy />}
			</Button>
		</Card>
	);
}
