"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
} from "@/components/section";
import { engineFetch, engineUrl } from "./engine-client";
import { MediaPicker, useMediaBin } from "./media-picker";
import { ColorWheel } from "@/components/editor/color/color-wheel";
import { CurvesEditor } from "@/components/editor/color/curves-editor";
import { GradePreview, type PreviewSource } from "@/components/editor/color/grade-preview";
import { InterchangeExport } from "@/components/editor/color/interchange-export";
import {
	buildCubeLut,
	createDefaultGrade,
	isIdentityGrade,
	type GradeState,
	type WheelValue,
} from "@/components/editor/color/grade-math";
import { SectionHeader, SectionTitle } from "@/components/section";

type Lut = { id: string; name: string; file: string };
type LutsResponse = { ok: boolean; count: number; luts: Lut[] };
type GradeResult = {
	ok: boolean;
	id: string;
	preview: string;
	bytes: number;
	lut: string | null;
};

type GradeParams = {
	brightness: number;
	contrast: number;
	saturation: number;
	gamma: number;
};

const NO_LUT = "__none__";

const DEFAULT_PARAMS: GradeParams = {
	brightness: 0,
	contrast: 1,
	saturation: 1,
	gamma: 1,
};

const SLIDERS: Array<{
	key: keyof GradeParams;
	label: string;
	min: number;
	max: number;
	step: number;
}> = [
	{ key: "brightness", label: "Helderheid", min: -1, max: 1, step: 0.01 },
	{ key: "contrast", label: "Contrast", min: 0, max: 4, step: 0.01 },
	{ key: "saturation", label: "Verzadiging", min: 0, max: 4, step: 0.01 },
	{ key: "gamma", label: "Gamma", min: 0.1, max: 10, step: 0.01 },
];

function VideoPreview({ src, label }: { src: string; label: string }) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-muted-foreground text-xs">{label}</span>
			<video
				src={src}
				controls
				muted
				preload="metadata"
				className="bg-background aspect-video w-full rounded-md border"
			/>
		</div>
	);
}

function EngineGrade() {
	const [luts, setLuts] = useState<Lut[]>([]);
	const [lutsError, setLutsError] = useState<string | null>(null);
	const [file, setFile] = useState<string | undefined>();
	const [lut, setLut] = useState<string>(NO_LUT);
	const [params, setParams] = useState<GradeParams>(DEFAULT_PARAMS);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<GradeResult | null>(null);

	const { items } = useMediaBin();
	const selectedItem = items.find((item) => item.file === file);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const res = await engineFetch<LutsResponse>("api/luts");
				if (!cancelled) setLuts(res.luts ?? []);
			} catch (e) {
				if (!cancelled)
					setLutsError(e instanceof Error ? e.message : "luts failed");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const handleGrade = async () => {
		if (!file) {
			setError("Kies eerst een video");
			return;
		}
		setBusy(true);
		setError(null);
		setResult(null);
		try {
			const res = await engineFetch<GradeResult>("api/grade", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					file,
					lut: lut === NO_LUT ? null : lut,
					brightness: params.brightness,
					contrast: params.contrast,
					saturation: params.saturation,
					gamma: params.gamma,
				}),
			});
			setResult(res);
		} catch (e) {
			setError(e instanceof Error ? e.message : "grade failed");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<Section showTopBorder={false} showBottomBorder={false}>
				<SectionContent className="flex flex-col gap-4">
					<SectionFields>
						<SectionField label="Video">
							<MediaPicker value={file} onValueChange={setFile} />
						</SectionField>
						<SectionField label="LUT">
							<Select value={lut} onValueChange={setLut}>
								<SelectTrigger>
									<SelectValue
										placeholder={lutsError ? "Engine niet bereikbaar" : "Geen"}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_LUT}>Geen</SelectItem>
									{luts.map((entry) => (
										<SelectItem key={entry.id} value={entry.id}>
											{entry.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>
						{SLIDERS.map((slider) => (
							<SectionField key={slider.key} label={slider.label}>
								<div className="flex items-center gap-3">
									<Slider
										value={[params[slider.key]]}
										min={slider.min}
										max={slider.max}
										step={slider.step}
										onValueChange={([value]) =>
											setParams((prev) => ({
												...prev,
												[slider.key]: value,
											}))
										}
									/>
									<span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
										{params[slider.key].toFixed(2)}
									</span>
								</div>
							</SectionField>
						))}
					</SectionFields>

					<Button
						type="button"
						className="w-full"
						onClick={handleGrade}
						disabled={busy || !file}
					>
						{busy && <Spinner className="mr-1" />}
						{busy ? "Bezig met kleurcorrectie..." : "Kleurcorrectie toepassen"}
					</Button>

					{error && (
						<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
							<p className="text-destructive text-sm">{error}</p>
						</div>
					)}

					{selectedItem && (
						<VideoPreview
							src={engineUrl(selectedItem.url)}
							label="Voor"
						/>
					)}
					{result && (
						<VideoPreview
							src={engineUrl(result.preview)}
							label={`Na (${Math.round(result.bytes / 1024)} KB)`}
						/>
					)}
				</SectionContent>
			</Section>
		</div>
	);
}

const BASIC_SLIDERS: Array<{
	key: "exposure" | "contrast" | "temperature" | "tint" | "saturation";
	label: string;
	min: number;
	max: number;
	step: number;
	neutral: number;
}> = [
	{ key: "exposure", label: "Belichting (stops)", min: -3, max: 3, step: 0.01, neutral: 0 },
	{ key: "contrast", label: "Contrast", min: -1, max: 1, step: 0.01, neutral: 0 },
	{ key: "temperature", label: "Temperatuur", min: -1, max: 1, step: 0.01, neutral: 0 },
	{ key: "tint", label: "Tint", min: -1, max: 1, step: 0.01, neutral: 0 },
	{ key: "saturation", label: "Verzadiging", min: 0, max: 2, step: 0.01, neutral: 1 },
];

const CHART = "__chart__";
const LOCAL = "__local__";

function downloadText(filename: string, text: string) {
	const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type PanelState = {
	grade: GradeState;
	setGrade: React.Dispatch<React.SetStateAction<GradeState>>;
	choice: string;
	setChoice: (value: string) => void;
	localSource: PreviewSource | null;
	setLocalSource: (value: PreviewSource | null) => void;
};

/** Onder deze breedte (px) past het paneel niet in de zijbalk: dan openen we het als scherm. */
const NARROW_PX = 280;

export function GradePanel() {
	const [grade, setGrade] = useState<GradeState>(createDefaultGrade);
	const [choice, setChoice] = useState<string>(CHART);
	const [localSource, setLocalSource] = useState<PreviewSource | null>(null);
	const [width, setWidth] = useState<number | null>(null);
	const [open, setOpen] = useState(false);
	const hostRef = useRef<HTMLDivElement>(null);
	const state: PanelState = { grade, setGrade, choice, setChoice, localSource, setLocalSource };

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const narrow = width !== null && width < NARROW_PX;
	return (
		<div ref={hostRef} className="h-full w-full">
			{narrow ? (
				<div className="flex h-full flex-col items-center gap-2 p-1" data-testid="color-panel-compact">
					<Button
						type="button"
						size="sm"
						variant="secondary"
						className="w-full px-1"
						aria-label="Kleurpaneel openen"
						onClick={() => setOpen(true)}
					>
						Kleur
					</Button>
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 sm:max-w-none">
							<DialogTitle className="border-b px-4 py-3 text-base">Kleurcorrectie</DialogTitle>
							<div className="min-h-0 flex-1 overflow-hidden">
								<GradePanelBody {...state} />
							</div>
						</DialogContent>
					</Dialog>
				</div>
			) : (
				<GradePanelBody {...state} />
			)}
		</div>
	);
}

function GradePanelBody({ grade, setGrade, choice, setChoice, localSource, setLocalSource }: PanelState) {
	const { items } = useMediaBin();

	const source: PreviewSource = (() => {
		if (choice === LOCAL && localSource) return localSource;
		const item = items.find((entry) => entry.file === choice);
		if (item) return { kind: item.kind, url: engineUrl(item.url) };
		return { kind: "chart" };
	})();

	const setWheel = (key: "lift" | "gamma" | "gain") => (value: WheelValue) =>
		setGrade((prev) => ({ ...prev, [key]: value }));

	return (
		<div className="@container flex h-full flex-col gap-4 overflow-y-auto p-4" data-testid="color-panel">
			<Section showTopBorder={false} showBottomBorder={false}>
				<SectionContent className="flex flex-col gap-4">
					<SectionFields>
						<SectionField label="Bron voor voorbeeld">
							<Select value={choice} onValueChange={setChoice}>
								<SelectTrigger aria-label="Bron voor voorbeeld">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={CHART}>Testbeeld</SelectItem>
									{localSource && <SelectItem value={LOCAL}>Eigen bestand</SelectItem>}
									{items.map((item) => (
										<SelectItem key={item.file} value={item.file}>
											{item.file}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>
					</SectionFields>
					<label className="text-muted-foreground flex flex-col gap-1 text-xs">
						Of kies een eigen beeld of video
						<input
							type="file"
							accept="image/*,video/*"
							data-testid="grade-local-file"
							className="text-foreground text-sm file:bg-secondary file:text-secondary-foreground file:border-secondary-border file:mr-2 file:rounded-sm file:border file:px-2 file:py-1"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (!file) return;
								if (localSource && localSource.kind !== "chart") URL.revokeObjectURL(localSource.url);
								const url = URL.createObjectURL(file);
								setLocalSource({ kind: file.type.startsWith("video/") ? "video" : "image", url });
								setChoice(LOCAL);
							}}
						/>
					</label>

					<GradePreview grade={grade} source={source} />
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen sectionKey="color-basic">
				<SectionHeader>
					<SectionTitle className="truncate">Basis</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields>
						{BASIC_SLIDERS.map((slider) => (
							<SectionField key={slider.key} label={slider.label}>
								<div className="flex items-center gap-3">
									<Slider
										aria-label={slider.label}
										value={[grade[slider.key]]}
										min={slider.min}
										max={slider.max}
										step={slider.step}
										onValueChange={([value]) => setGrade((prev) => ({ ...prev, [slider.key]: value }))}
										onDoubleClick={() => setGrade((prev) => ({ ...prev, [slider.key]: slider.neutral }))}
									/>
									<span className="text-muted-foreground w-12 text-right text-xs tabular-nums">
										{grade[slider.key].toFixed(2)}
									</span>
								</div>
							</SectionField>
						))}
					</SectionFields>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen sectionKey="color-wheels">
				<SectionHeader>
					<SectionTitle className="truncate">Kleurwielen</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<div className="grid grid-cols-1 gap-4 @min-[20rem]:grid-cols-3 @min-[20rem]:gap-2">
						<ColorWheel label="Lift" value={grade.lift} onChange={setWheel("lift")} />
						<ColorWheel label="Gamma" value={grade.gamma} onChange={setWheel("gamma")} />
						<ColorWheel label="Gain" value={grade.gain} onChange={setWheel("gain")} />
					</div>
					<p className="text-muted-foreground mt-2 text-xs">
						Dubbelklik op een wiel om te herstellen. Pijltjestoetsen verplaatsen de puck.
					</p>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen={false} sectionKey="color-curves">
				<SectionHeader>
					<SectionTitle className="truncate">RGB-curves</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<CurvesEditor
						curves={grade.curves}
						onChange={(channel, points) =>
							setGrade((prev) => ({ ...prev, curves: { ...prev.curves, [channel]: points } }))
						}
					/>
				</SectionContent>
			</Section>

			<Section>
				<SectionContent className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => setGrade(createDefaultGrade())} disabled={isIdentityGrade(grade)}>
							Alles herstellen
						</Button>
						<Button
							type="button"
							size="sm"
							data-testid="export-cube"
							onClick={() => downloadText("dgdh-cut-grade.cube", buildCubeLut(grade, 33))}
						>
							LUT exporteren (.cube)
						</Button>
					</div>
					<p className="text-muted-foreground text-xs">
						De .cube bevat de volledige correctie en werkt in elke editor met 3D-LUT-ondersteuning.
					</p>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen={false} sectionKey="color-interchange">
				<SectionHeader>
					<SectionTitle className="truncate">Tijdlijn uitwisselen</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<InterchangeExport />
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen={false} sectionKey="color-engine" showBottomBorder={false}>
				<SectionHeader>
					<SectionTitle className="truncate">Engine-render (LUT en basis)</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<EngineGrade />
				</SectionContent>
			</Section>
		</div>
	);
}
