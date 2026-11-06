"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	IMPORT_RATES,
	autoMatchMedia,
	listMediaRefs,
	parseImportFile,
	type MatchMethod,
} from "@/services/interchange/import-project";
import { importInterchangeProject } from "@/services/interchange/import-service";
import type { InterchangeFormat, InterchangeTimeline } from "@/services/interchange";

const MEDIA_ACCEPT = "video/*,audio/*,image/*";
const selectClass =
	"h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden";

type Assignment = { fileIndex: number | null; method: MatchMethod | "handmatig" | null };

/**
 * Importeert een EDL-, FCPXML- of OTIO-bestand als nieuw project. Gebruiker
 * kiest de mediabestanden; koppeling op naam/reel gaat automatisch, de rest
 * handmatig per verwijzing.
 */
export function ImportInterchangeDialog({ className }: { className?: string }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [source, setSource] = useState<{ name: string; text: string } | null>(null);
	const [rateId, setRateId] = useState("25");
	const [parsed, setParsed] = useState<{ format: InterchangeFormat; timeline: InterchangeTimeline } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [mediaFiles, setMediaFiles] = useState<File[]>([]);
	const [manual, setManual] = useState<Record<string, number | null>>({});
	const [name, setName] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	const rate = IMPORT_RATES.find((r) => r.id === rateId)?.rate ?? IMPORT_RATES[1].rate;

	const parse = (src: { name: string; text: string } | null, nextRate = rate) => {
		setError(null);
		if (!src) return setParsed(null);
		try {
			const result = parseImportFile({ fileName: src.name, text: src.text, rate: nextRate });
			setParsed(result);
			setName((current) => current || result.timeline.name || src.name.replace(/\.[^.]+$/, ""));
		} catch (e) {
			setParsed(null);
			setError(e instanceof Error ? e.message : "Bestand lezen mislukt.");
		}
	};

	const refs = useMemo(() => (parsed ? listMediaRefs(parsed.timeline) : []), [parsed]);
	const auto = useMemo(
		() =>
			autoMatchMedia({
				refs: refs.map((r) => r.name),
				fileNames: mediaFiles.map((f) => f.name),
			}),
		[refs, mediaFiles],
	);
	const assignment = (ref: string): Assignment => {
		if (ref in manual) {
			const index = manual[ref];
			return { fileIndex: index, method: index == null ? null : "handmatig" };
		}
		const hit = auto[ref];
		return hit ? { fileIndex: hit.fileIndex, method: hit.method } : { fileIndex: null, method: null };
	};
	const linked = refs.filter((r) => assignment(r.name).fileIndex != null);
	const placeable = parsed
		? parsed.timeline.clips.filter((c) => assignment(c.media).fileIndex != null).length
		: 0;

	const reset = () => {
		setSource(null);
		setParsed(null);
		setError(null);
		setMediaFiles([]);
		setManual({});
		setName("");
		setBusy(null);
	};

	const run = async () => {
		if (!parsed) return;
		try {
			setBusy("Importeren…");
			const files: Record<string, File | undefined> = {};
			for (const r of refs) {
				const index = assignment(r.name).fileIndex;
				files[r.name] = index == null ? undefined : mediaFiles[index];
			}
			const result = await importInterchangeProject({
				timeline: parsed.timeline,
				files,
				name: name.trim() || undefined,
				onProgress: setBusy,
			});
			if (result.skipped.length > 0) {
				toast.warning(`${result.skipped.length} clip(s) overgeslagen: geen mediabestand gekoppeld.`);
			}
			toast.success(`Project gemaakt met ${result.placed} clips.`);
			setOpen(false);
			reset();
			router.push(`/editor/${result.projectId}`);
		} catch (e) {
			setBusy(null);
			setError(e instanceof Error ? e.message : "Importeren mislukt.");
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) reset();
			}}
		>
			<DialogTrigger asChild>
				<Button size="lg" variant="outline" className={className} data-testid="import-open">
					Importeren
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl gap-5 p-6" data-testid="import-dialog">
				<DialogHeader>
					<DialogTitle>Tijdlijn importeren</DialogTitle>
					<DialogDescription>
						Maak een nieuw project van een EDL-, FCPXML- of OTIO-bestand. Kies daarna de
						bijbehorende mediabestanden.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2">
					<Label htmlFor="import-timeline">1. Tijdlijnbestand</Label>
					<Input
						id="import-timeline"
						data-testid="import-timeline"
						type="file"
						accept=".edl,.fcpxml,.xml,.otio,.json"
						onChange={async (e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							const next = { name: file.name, text: await file.text() };
							setSource(next);
							setManual({});
							setName("");
							parse(next);
						}}
					/>
					{source && /\.edl$/i.test(source.name) && (
						<div className="flex items-center gap-2">
							<Label htmlFor="import-rate" className="shrink-0">
								Beeldsnelheid
							</Label>
							<select
								id="import-rate"
								data-testid="import-rate"
								className={selectClass}
								value={rateId}
								onChange={(e) => {
									setRateId(e.target.value);
									parse(source, IMPORT_RATES.find((r) => r.id === e.target.value)?.rate);
								}}
							>
								{IMPORT_RATES.map((r) => (
									<option key={r.id} value={r.id}>
										{r.label}
									</option>
								))}
							</select>
						</div>
					)}
					{parsed && (
						<p className="text-muted-foreground text-xs" data-testid="import-summary">
							{parsed.timeline.clips.length} clips · {refs.length} bronbestanden ·{" "}
							{parsed.timeline.rate.num / parsed.timeline.rate.den === Math.round(parsed.timeline.rate.num / parsed.timeline.rate.den)
								? parsed.timeline.rate.num / parsed.timeline.rate.den
								: (parsed.timeline.rate.num / parsed.timeline.rate.den).toFixed(2)}{" "}
							fps · {parsed.format.toUpperCase()}
						</p>
					)}
					{error && (
						<p className="text-destructive text-sm" role="alert" data-testid="import-error">
							{error}
						</p>
					)}
				</div>

				{parsed && (
					<div className="flex flex-col gap-2">
						<Label htmlFor="import-media">2. Mediabestanden</Label>
						<Input
							id="import-media"
							data-testid="import-media"
							type="file"
							multiple
							accept={MEDIA_ACCEPT}
							onChange={(e) => {
								setMediaFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
								e.target.value = "";
							}}
						/>
						<ul className="flex max-h-64 flex-col gap-2 overflow-y-auto" data-testid="import-refs">
							{refs.map((r) => {
								const a = assignment(r.name);
								return (
									<li
										key={r.name}
										className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 text-sm"
										data-testid="import-ref"
									>
										<div className="min-w-0">
											<div className="truncate font-medium">{r.name}</div>
											<div className="text-muted-foreground text-xs">
												{r.clips} {r.clips === 1 ? "clip" : "clips"}
											</div>
										</div>
										<select
											aria-label={`Mediabestand voor ${r.name}`}
											className={selectClass}
											value={a.fileIndex ?? ""}
											onChange={(e) =>
												setManual((m) => ({
													...m,
													[r.name]: e.target.value === "" ? null : Number(e.target.value),
												}))
											}
										>
											<option value="">Niet gekoppeld</option>
											{mediaFiles.map((f, i) => (
												<option key={`${f.name}-${i}`} value={i}>
													{f.name}
												</option>
											))}
										</select>
										<span
											className={a.method ? "text-xs" : "text-destructive text-xs"}
											data-testid="import-ref-status"
										>
											{a.method === "handmatig"
												? "Handmatig"
												: a.method
													? `Automatisch (${a.method})`
													: "Ontbreekt"}
										</span>
									</li>
								);
							})}
						</ul>
						<p className="text-muted-foreground text-xs">
							{linked.length} van {refs.length} bronnen gekoppeld · {placeable} van{" "}
							{parsed.timeline.clips.length} clips worden geplaatst.
						</p>
					</div>
				)}

				{parsed && (
					<div className="flex items-end gap-3">
						<div className="flex flex-1 flex-col gap-2">
							<Label htmlFor="import-name">3. Projectnaam</Label>
							<Input
								id="import-name"
								data-testid="import-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<Button
							size="lg"
							disabled={placeable === 0 || busy != null}
							onClick={run}
							data-testid="import-run"
						>
							{busy ?? "Project maken"}
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
