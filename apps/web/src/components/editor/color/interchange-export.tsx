"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { TICKS_PER_SECOND } from "@/wasm";
import {
	INTERCHANGE_FORMATS,
	INTERCHANGE_META,
	buildInterchangeTimeline,
	serializeInterchange,
	type InterchangeFormat,
} from "@/services/interchange";

function download(filename: string, mime: string, text: string) {
	const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exporteert de hoofdscène van het actieve project naar EDL, FCPXML of OTIO. */
export function InterchangeExport() {
	const editor = useEditor();
	const project = useEditor((e) => e.project.getActiveOrNull());
	const [message, setMessage] = useState<string | null>(null);

	const run = (format: InterchangeFormat) => {
		if (!project) return;
		const timeline = buildInterchangeTimeline({
			project,
			assets: editor.media.getAssets(),
			ticksPerSecond: TICKS_PER_SECOND,
		});
		if (timeline.clips.length === 0) {
			setMessage("Geen clips om te exporteren. Voeg eerst beeld of audio toe aan de tijdlijn.");
			return;
		}
		const meta = INTERCHANGE_META[format];
		const base = (project.metadata.name || "dgdh-cut").replace(/[^\w.-]+/g, "-");
		download(`${base}${meta.extension}`, meta.mime, serializeInterchange(format, timeline));
		setMessage(`${meta.label} geëxporteerd: ${timeline.clips.length} clips.`);
	};

	return (
		<div className="flex flex-col gap-2" data-testid="interchange-export">
			<div className="flex flex-wrap gap-2">
				{INTERCHANGE_FORMATS.map((format) => (
					<Button
						key={format}
						type="button"
						size="sm"
						variant="outline"
						disabled={!project}
						data-testid={`export-${format}`}
						onClick={() => run(format)}
					>
						{INTERCHANGE_META[format].label}
					</Button>
				))}
			</div>
			<p className="text-muted-foreground text-xs" role="status">
				{message ??
					"Hoofdtrack, overlay-video en audio. Tekst, stickers en effecten gaan niet mee."}
			</p>
		</div>
	);
}
