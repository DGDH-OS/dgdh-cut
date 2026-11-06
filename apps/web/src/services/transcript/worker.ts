import {
	pipeline,
	type AutomaticSpeechRecognitionPipeline,
	type AutomaticSpeechRecognitionOutput,
} from "@huggingface/transformers";
import {
	DEFAULT_CHUNK_LENGTH_SECONDS,
	DEFAULT_STRIDE_SECONDS,
} from "@/transcription/audio";

export type TranscriptWorkerMessage =
	| { type: "init"; modelId: string }
	| { type: "transcribe"; audio: Float32Array; language: string };

export type TranscriptWorkerResponse =
	| { type: "init-progress"; progress: number }
	| { type: "init-complete" }
	| { type: "init-error"; error: string }
	| {
			type: "done";
			chunks: { text: string; start: number; end: number }[];
	  }
	| { type: "error"; error: string };

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;
const fileBytes = new Map<string, { loaded: number; total: number }>();

function reply(message: TranscriptWorkerResponse) {
	self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<TranscriptWorkerMessage>) => {
	const message = event.data;
	if (message.type === "init") {
		try {
			transcriber = (await pipeline("automatic-speech-recognition", message.modelId, {
				dtype: "q4",
				device: "auto",
				progress_callback: (info: {
					status?: string;
					file?: string;
					loaded?: number;
					total?: number;
				}) => {
					if (!info.file) return;
					if (info.status === "progress" && (info.total ?? 0) > 0) {
						fileBytes.set(info.file, {
							loaded: info.loaded ?? 0,
							total: info.total ?? 0,
						});
					}
					let loaded = 0;
					let total = 0;
					for (const v of fileBytes.values()) {
						loaded += v.loaded;
						total += v.total;
					}
					if (total > 0) {
						reply({ type: "init-progress", progress: Math.floor((loaded / total) * 100) });
					}
				},
			})) as unknown as AutomaticSpeechRecognitionPipeline;
			reply({ type: "init-complete" });
		} catch (error) {
			reply({
				type: "init-error",
				error: error instanceof Error ? error.message : "Model laden mislukt",
			});
		}
		return;
	}

	if (!transcriber) {
		reply({ type: "error", error: "Model niet geladen" });
		return;
	}
	try {
		const raw = await transcriber(message.audio, {
			chunk_length_s: DEFAULT_CHUNK_LENGTH_SECONDS,
			stride_length_s: DEFAULT_STRIDE_SECONDS,
			language: message.language,
			task: "transcribe",
			return_timestamps: "word",
		});
		const result: AutomaticSpeechRecognitionOutput = Array.isArray(raw) ? raw[0] : raw;
		const chunks = (result.chunks ?? []).flatMap((chunk) => {
			const [start, end] = chunk.timestamp ?? [];
			if (start === null || start === undefined) return [];
			return [{ text: chunk.text, start, end: end ?? start }];
		});
		reply({ type: "done", chunks });
	} catch (error) {
		reply({
			type: "error",
			error: error instanceof Error ? error.message : "Transcriptie mislukt",
		});
	}
};
