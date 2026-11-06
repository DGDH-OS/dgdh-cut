"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { SectionField, SectionFields } from "@/components/section";
import { engineFetch, engineUrl } from "./engine-client";
import { MediaPicker } from "./media-picker";

type Style = {
	name: string;
	description: string;
	format: unknown;
	hook: string;
	lut: string | null;
	cta: unknown;
	reference: string;
};

type StylesResponse = { ok: boolean; styles: Style[] };

type KaraokeResult = {
	ok: boolean;
	id: string;
	preview: string;
	bytes: number;
	words_used: number;
};

type StyleCaption = {
	size?: number;
	color?: string;
	active_color?: string;
	karaoke?: boolean;
};

const EFFECTS = ["highlight", "glow", "box", "pop", "none"] as const;

const DEFAULT_HIGHLIGHT = "#FFE500";
const DEFAULT_FONT_SIZE = 44;

function styleJsonUrl(reference: string): string {
	return reference.replace(/\/reference\.png$/, "/style.json");
}

export function KaraokePanel() {
	const [styles, setStyles] = useState<Style[]>([]);
	const [stylesError, setStylesError] = useState<string | null>(null);
	const [file, setFile] = useState<string | undefined>();
	const [style, setStyle] = useState<string>("");
	const [styleDescription, setStyleDescription] = useState<string>("");
	const [styleReference, setStyleReference] = useState<string>("");
	const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
	const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT);
	const [effect, setEffect] = useState<string>("highlight");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<KaraokeResult | null>(null);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const res = await engineFetch<StylesResponse>("api/styles");
				if (!cancelled) setStyles(res.styles ?? []);
			} catch (e) {
				if (!cancelled)
					setStylesError(e instanceof Error ? e.message : "styles failed");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleStyleChange = async (value: string) => {
		setStyle(value);
		const chosen = styles.find((entry) => entry.name === value);
		if (!chosen) return;
		setStyleDescription(chosen.description);
		setStyleReference(chosen.reference);
		// A chosen style may carry caption defaults in its style.json; apply them.
		try {
			const cfg = await engineFetch<{ caption?: StyleCaption }>(
				styleJsonUrl(chosen.reference),
			);
			const caption = cfg.caption;
			if (caption?.active_color) setHighlightColor(caption.active_color);
			if (caption?.size) setFontSize(caption.size);
		} catch {
			// Style preview is best-effort; keep current defaults on failure.
		}
	};

	const handleGenerate = async () => {
		if (!file) {
			setError("Select a video first");
			return;
		}
		setBusy(true);
		setError(null);
		setResult(null);
		try {
			const res = await engineFetch<KaraokeResult>("api/karaoke", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					file,
					font_size: fontSize,
					highlight_color: highlightColor,
					effect,
				}),
			});
			setResult(res);
		} catch (e) {
			setError(e instanceof Error ? e.message : "karaoke failed");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<SectionFields>
				<SectionField label="Video">
					<MediaPicker value={file} onValueChange={setFile} />
				</SectionField>
				<SectionField label="Style">
					<Select value={style} onValueChange={handleStyleChange}>
						<SelectTrigger>
							<SelectValue
								placeholder={
									stylesError ? "Engine unreachable" : "Select a style"
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{styles.map((entry) => (
								<SelectItem key={entry.name} value={entry.name}>
									{entry.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SectionField>
				{styleDescription && (
					<p className="text-muted-foreground text-xs">{styleDescription}</p>
				)}
				{styleReference && (
					<img
						src={engineUrl(styleReference)}
						alt={style}
						className="bg-black aspect-video w-full rounded-md border object-cover"
					/>
				)}
				<SectionField label={`Font size (${fontSize})`}>
					<Slider
						value={[fontSize]}
						min={10}
						max={120}
						step={1}
						onValueChange={([value]) => setFontSize(value)}
					/>
				</SectionField>
				<SectionField label="Highlight color">
					<div className="flex items-center gap-3">
						<input
							type="color"
							value={highlightColor}
							onChange={(event) => setHighlightColor(event.target.value)}
							className="border-border bg-accent h-7 w-10 cursor-pointer rounded-md border"
							aria-label="Highlight color"
						/>
						<span className="text-muted-foreground text-xs tabular-nums">
							{highlightColor}
						</span>
					</div>
				</SectionField>
				<SectionField label="Effect">
					<Select value={effect} onValueChange={setEffect}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{EFFECTS.map((option) => (
								<SelectItem key={option} value={option}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</SectionField>
			</SectionFields>

			<Button
				type="button"
				className="w-full"
				onClick={handleGenerate}
				disabled={busy || !file}
			>
				{busy && <Spinner className="mr-1" />}
				{busy ? "Burning captions..." : "Generate karaoke captions"}
			</Button>

			{error && (
				<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
					<p className="text-destructive text-sm">{error}</p>
				</div>
			)}

			{result && (
				<div className="flex flex-col gap-1.5">
					<span className="text-muted-foreground text-xs">
						Preview ({result.words_used} words,{" "}
						{Math.round(result.bytes / 1024)} KB)
					</span>
					<video
						src={engineUrl(result.preview)}
						controls
						preload="metadata"
						className="bg-black aspect-video w-full rounded-md border"
					/>
				</div>
			)}
		</div>
	);
}
