"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GradeRenderer, type GradeSource } from "./grade-renderer";
import type { GradeState } from "./grade-math";
import {
	computeScopes,
	drawHistogram,
	drawVectorscope,
	drawWaveform,
} from "./scopes";
import { drawTestChart } from "./test-chart";

const PREVIEW_WIDTH = 640;
const SCOPE_W = 256;
const SCOPE_H = 144;

export type PreviewSource =
	| { kind: "chart" }
	| { kind: "video"; url: string }
	| { kind: "image"; url: string };

function sourceSize(src: GradeSource): { width: number; height: number } {
	if (src instanceof HTMLVideoElement) return { width: src.videoWidth, height: src.videoHeight };
	if (src instanceof HTMLImageElement) return { width: src.naturalWidth, height: src.naturalHeight };
	return { width: src.width, height: src.height };
}

function ScopeCanvas({
	canvasRef,
	label,
	width,
	height,
	testId,
}: {
	canvasRef: React.RefObject<HTMLCanvasElement | null>;
	label: string;
	width: number;
	height: number;
	testId: string;
}) {
	return (
		<figure className="flex min-w-0 flex-col gap-1">
			<figcaption className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</figcaption>
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				role="img"
				aria-label={label}
				data-testid={testId}
				className="border-border bg-background w-full rounded-sm border"
			/>
		</figure>
	);
}

/**
 * Toont de bron met de correctie live (WebGL) en berekent de scopes uit
 * het gerenderde canvas. Bron: eigen testbeeld, afbeelding of video.
 */
export function GradePreview({
	grade,
	source,
}: {
	grade: GradeState;
	source: PreviewSource;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<GradeRenderer | null>(null);
	const sourceElRef = useRef<GradeSource | null>(null);
	const gradeRef = useRef(grade);
	gradeRef.current = grade;
	const scopeSrcRef = useRef<HTMLCanvasElement | null>(null);
	const histRef = useRef<HTMLCanvasElement>(null);
	const waveRef = useRef<HTMLCanvasElement>(null);
	const vecRef = useRef<HTMLCanvasElement>(null);
	const rafRef = useRef<number | null>(null);
	const [mode, setMode] = useState<"webgl" | "cpu" | null>(null);
	const [playing, setPlaying] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const src = sourceElRef.current;
		if (!canvas || !src) return;
		if (!rendererRef.current) {
			rendererRef.current = new GradeRenderer(canvas);
			setMode(rendererRef.current.mode);
		}
		const { width: srcW, height: srcH } = sourceSize(src);
		if (!srcW || !srcH) return;
		const width = Math.min(PREVIEW_WIDTH, srcW);
		const height = Math.round((width * srcH) / srcW);
		rendererRef.current.render(src, gradeRef.current, { width, height });

		// Scopes uit het gerenderde beeld, verkleind voor snelheid.
		const sc = (scopeSrcRef.current ??= document.createElement("canvas"));
		sc.width = SCOPE_W;
		sc.height = Math.max(1, Math.round((SCOPE_W * height) / width));
		const sctx = sc.getContext("2d", { willReadFrequently: true });
		if (!sctx) return;
		sctx.drawImage(canvas, 0, 0, sc.width, sc.height);
		const frame = sctx.getImageData(0, 0, sc.width, sc.height);
		const data = computeScopes(frame.data, sc.width, sc.height);
		const h = histRef.current?.getContext("2d");
		const w = waveRef.current?.getContext("2d", { willReadFrequently: true });
		const v = vecRef.current?.getContext("2d");
		if (h) drawHistogram(h, data, SCOPE_W, SCOPE_H);
		if (w) drawWaveform(w, data, SCOPE_W, SCOPE_H);
		if (v) drawVectorscope(v, data, SCOPE_H);
	}, []);

	// Bron laden
	useEffect(() => {
		setError(null);
		setPlaying(false);
		let cancelled = false;
		let videoEl: HTMLVideoElement | null = null;
		if (source.kind === "chart") {
			const c = document.createElement("canvas");
			drawTestChart(c);
			sourceElRef.current = c;
			draw();
			return;
		}
		if (source.kind === "image") {
			const img = new Image();
			img.onload = () => {
				if (cancelled) return;
				sourceElRef.current = img;
				draw();
			};
			img.onerror = () => !cancelled && setError("Afbeelding kon niet worden geladen");
			img.src = source.url;
			return () => {
				cancelled = true;
			};
		}
		videoEl = document.createElement("video");
		videoEl.muted = true;
		videoEl.loop = true;
		videoEl.playsInline = true;
		videoEl.crossOrigin = "anonymous";
		videoEl.preload = "auto";
		const onReady = () => {
			if (cancelled) return;
			sourceElRef.current = videoEl;
			draw();
		};
		videoEl.addEventListener("loadeddata", onReady);
		videoEl.addEventListener("seeked", onReady);
		videoEl.addEventListener("error", () => !cancelled && setError("Video kon niet worden geladen"));
		videoEl.src = source.url;
		return () => {
			cancelled = true;
			videoEl?.pause();
			videoEl?.removeAttribute("src");
			videoEl?.load();
		};
	}, [source, draw]);

	// Opnieuw tekenen als de correctie wijzigt
	// biome-ignore lint/correctness/useExhaustiveDependencies: grade is de trigger
	useEffect(() => {
		draw();
	}, [grade, draw]);

	// Afspeel-loop voor video
	useEffect(() => {
		const src = sourceElRef.current;
		if (!playing || !(src instanceof HTMLVideoElement)) return;
		void src.play().catch(() => setPlaying(false));
		let last = 0;
		const tick = (now: number) => {
			if (now - last > 66) {
				last = now;
				draw();
			}
			rafRef.current = requestAnimationFrame(tick);
		};
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			src.pause();
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [playing, draw]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<canvas
					ref={canvasRef}
					data-testid="grade-preview"
					role="img"
					aria-label="Voorbeeld met kleurcorrectie"
					className="border-border bg-background aspect-video w-full rounded-md border object-contain"
				/>
				<div className="flex items-center justify-between gap-2">
					<span className="text-muted-foreground text-xs" data-testid="grade-render-mode">
						{mode === "webgl" ? "Live via WebGL" : mode === "cpu" ? "Live via CPU (geen WebGL)" : "Laden"}
					</span>
					{source.kind === "video" && (
						<Button type="button" size="sm" variant="outline" onClick={() => setPlaying((p) => !p)}>
							{playing ? "Pauze" : "Afspelen"}
						</Button>
					)}
				</div>
				{error && <p className="text-destructive text-sm">{error}</p>}
			</div>
			<div className="grid grid-cols-1 gap-3 @min-[22rem]:grid-cols-2">
				<ScopeCanvas canvasRef={waveRef} label="Waveform" width={SCOPE_W} height={SCOPE_H} testId="scope-waveform" />
				<ScopeCanvas canvasRef={histRef} label="Histogram" width={SCOPE_W} height={SCOPE_H} testId="scope-histogram" />
				<ScopeCanvas canvasRef={vecRef} label="Vectorscope" width={SCOPE_H} height={SCOPE_H} testId="scope-vectorscope" />
			</div>
		</div>
	);
}
