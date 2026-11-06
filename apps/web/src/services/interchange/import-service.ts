/**
 * Browser-kant van de import: media verwerken (duur, afmetingen), project en
 * media opslaan via de bestaande storageService. Geen undo nodig: het maakt
 * altijd een nieuw project aan.
 */
import { DEFAULT_BACKGROUND_COLOR } from "@/background/color";
import { processMediaAssets } from "@/media/processing";
import type { MediaAsset } from "@/media/types";
import { CURRENT_PROJECT_VERSION } from "@/services/storage/migrations";
import { storageService } from "@/services/storage/service";
import { buildElementFromMedia } from "@/timeline/element-utils";
import { buildDefaultScene } from "@/timeline/scenes";
import { generateUUID } from "@/utils/id";
import { TICKS_PER_SECOND } from "@/wasm";
import {
	buildProjectFromInterchange,
	type BuildImportResult,
	type ImportDeps,
	type ImportMedia,
} from "./import-project";
import type { InterchangeTimeline } from "./types";

const deps: ImportDeps = {
	buildScene: () => buildDefaultScene({ name: "Hoofdscène", isMain: true }),
	buildElement: (args) => buildElementFromMedia(args) as unknown as Record<string, unknown>,
	version: CURRENT_PROJECT_VERSION,
	backgroundColor: DEFAULT_BACKGROUND_COLOR,
};

export type ImportResult = { projectId: string } & Pick<BuildImportResult, "placed" | "skipped">;

export async function importInterchangeProject({
	timeline,
	files,
	name,
	onProgress,
}: {
	timeline: InterchangeTimeline;
	/** verwijzing (bestandsnaam/reel uit de tijdlijn) -> gekozen mediabestand */
	files: Record<string, File | undefined>;
	name?: string;
	onProgress?: (message: string) => void;
}): Promise<ImportResult> {
	const media: Record<string, ImportMedia> = {};
	const assets: MediaAsset[] = [];
	const done = new Map<File, MediaAsset>();

	for (const [ref, file] of Object.entries(files)) {
		if (!file) continue;
		let asset = done.get(file);
		if (!asset) {
			onProgress?.(`Media verwerken: ${file.name}`);
			const [processed] = await processMediaAssets({ files: [file] });
			if (!processed) continue; // niet ondersteund; processMediaAssets toont de melding
			asset = { ...processed, id: generateUUID() };
			done.set(file, asset);
			assets.push(asset);
		}
		media[ref] = { id: asset.id, type: asset.type, durationSeconds: asset.duration };
	}

	const result = buildProjectFromInterchange({
		timeline,
		media,
		name,
		ticksPerSecond: TICKS_PER_SECOND,
		deps,
	});
	if (result.placed === 0) {
		throw new Error("Geen enkele clip kon worden geplaatst. Koppel eerst mediabestanden.");
	}
	const project = result.project;
	const projectId = project.metadata.id;
	for (const asset of assets) {
		onProgress?.(`Opslaan: ${asset.name}`);
		await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
	}
	onProgress?.("Project opslaan");
	await storageService.saveProject({ project });
	return { projectId, placed: result.placed, skipped: result.skipped };
}
