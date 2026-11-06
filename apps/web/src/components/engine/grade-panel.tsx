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
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
} from "@/components/section";
import { engineFetch, engineUrl } from "./engine-client";
import { MediaPicker, useMediaBin } from "./media-picker";

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
	{ key: "brightness", label: "Brightness", min: -1, max: 1, step: 0.01 },
	{ key: "contrast", label: "Contrast", min: 0, max: 4, step: 0.01 },
	{ key: "saturation", label: "Saturation", min: 0, max: 4, step: 0.01 },
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

export function GradePanel() {
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
			setError("Select a video first");
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
		<div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
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
										placeholder={lutsError ? "Engine unreachable" : "None"}
									/>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NO_LUT}>None</SelectItem>
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
						{busy ? "Grading..." : "Apply grade"}
					</Button>

					{error && (
						<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
							<p className="text-destructive text-sm">{error}</p>
						</div>
					)}

					{selectedItem && (
						<VideoPreview
							src={engineUrl(selectedItem.url)}
							label="Before"
						/>
					)}
					{result && (
						<VideoPreview
							src={engineUrl(result.preview)}
							label={`After (${Math.round(result.bytes / 1024)} KB)`}
						/>
					)}
				</SectionContent>
			</Section>
		</div>
	);
}
