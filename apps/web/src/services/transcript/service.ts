import { TRANSCRIPTION_MODELS } from "@/transcription/models";
import type { TranscriptionModelId, TranscriptionProgress } from "@/transcription/types";
import type {
	TranscriptWorkerMessage,
	TranscriptWorkerResponse,
} from "./worker";
import { buildWords } from "./words";
import type { TranscriptLanguage, TranscriptWord } from "./types";

/** Woord-niveau transcriptie in een eigen worker (hergebruikt modellijst en audio-constanten). */
export async function transcribeWords({
	audioData,
	language,
	modelId = "whisper-small",
	onProgress,
}: {
	audioData: Float32Array;
	language: TranscriptLanguage;
	modelId?: TranscriptionModelId;
	onProgress?: (progress: TranscriptionProgress) => void;
}): Promise<TranscriptWord[]> {
	const model = TRANSCRIPTION_MODELS.find((m) => m.id === modelId);
	if (!model) throw new Error(`Onbekend model: ${modelId}`);
	// Woord-timestamps vragen om een export met cross-attentions: de
	// `_timestamped`-variant van hetzelfde Whisper-model.
	const wordModelId = `${model.huggingFaceId}_timestamped`;
	const worker = new Worker(new URL("./worker.ts", import.meta.url), {
		type: "module",
	});
	try {
		await new Promise<void>((resolve, reject) => {
			worker.onmessage = (e: MessageEvent<TranscriptWorkerResponse>) => {
				const r = e.data;
				if (r.type === "init-progress") {
					onProgress?.({
						status: "loading-model",
						progress: r.progress,
						message: `Model ${model.name} laden...`,
					});
				} else if (r.type === "init-complete") resolve();
				else if (r.type === "init-error") reject(new Error(r.error));
			};
			worker.postMessage({
				type: "init",
				modelId: wordModelId,
			} satisfies TranscriptWorkerMessage);
		});
		onProgress?.({ status: "transcribing", progress: 0, message: "Transcriberen..." });
		const chunks = await new Promise<{ text: string; start: number; end: number }[]>(
			(resolve, reject) => {
				worker.onmessage = (e: MessageEvent<TranscriptWorkerResponse>) => {
					const r = e.data;
					if (r.type === "done") resolve(r.chunks);
					else if (r.type === "error") reject(new Error(r.error));
				};
				worker.postMessage({
					type: "transcribe",
					audio: audioData,
					language,
				} satisfies TranscriptWorkerMessage);
			},
		);
		return buildWords({ chunks });
	} finally {
		worker.terminate();
	}
}
