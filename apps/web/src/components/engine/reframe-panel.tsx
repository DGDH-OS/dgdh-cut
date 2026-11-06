"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
	Section,
	SectionContent,
	SectionField,
	SectionFields,
} from "@/components/section";
import { engineFetch, engineUrl } from "./engine-client";
import { MediaPicker } from "./media-picker";

type ReframeResult = {
	ok: boolean;
	id: string;
	preview: string;
	bytes: number;
	output_size: string;
	face_rate: number;
	samples: number;
};

const FORMATS = [
	{ label: "9:16 (1080x1920)", value: "1080x1920" },
	{ label: "1:1 (1080x1080)", value: "1080x1080" },
	{ label: "16:9 (1920x1080)", value: "1920x1080" },
] as const;

export function ReframePanel() {
	const [file, setFile] = useState<string | undefined>();
	const [outputSize, setOutputSize] = useState<string>("1080x1920");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<ReframeResult | null>(null);

	const handleReframe = async () => {
		if (!file) {
			setError("Kies eerst een video");
			return;
		}
		setBusy(true);
		setError(null);
		setResult(null);
		try {
			const res = await engineFetch<ReframeResult>("api/reframe", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ file, output_size: outputSize }),
			});
			setResult(res);
		} catch (e) {
			setError(e instanceof Error ? e.message : "reframe failed");
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
						<SectionField label="Uitvoerformaat">
							<Select value={outputSize} onValueChange={setOutputSize}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{FORMATS.map((format) => (
										<SelectItem key={format.value} value={format.value}>
											{format.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</SectionField>
					</SectionFields>

					<Button
						type="button"
						className="w-full"
						onClick={handleReframe}
						disabled={busy || !file}
					>
						{busy && <Spinner className="mr-1" />}
						{busy ? "Bezig met bijsnijden..." : "Bijsnijden"}
					</Button>

					{error && (
						<div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
							<p className="text-destructive text-sm">{error}</p>
						</div>
					)}

					{result && (
						<div className="flex flex-col gap-1.5">
							<span className="text-muted-foreground text-xs">
								{result.output_size} · face rate {result.face_rate} ·{" "}
								{Math.round(result.bytes / 1024)} KB
							</span>
							<video
								src={engineUrl(result.preview)}
								controls
								preload="metadata"
								className="bg-background w-full rounded-md border"
							/>
						</div>
					)}
				</SectionContent>
			</Section>
		</div>
	);
}
