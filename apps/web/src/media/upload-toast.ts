import { toast } from "sonner";

export interface MediaUploadToastResult {
	uploadedCount: number;
	assetNames?: string[];
}

function getAssetLabel({ count }: { count: number }): string {
	return count === 1 ? "mediabestand" : "mediabestanden";
}

function waitForNextPaint(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve());
		});
	});
}

export async function showMediaUploadToast<T extends MediaUploadToastResult>({
	filesCount,
	promise,
}: {
	filesCount: number;
	promise: Promise<T> | (() => Promise<T>);
}) {
	const run = typeof promise === "function" ? promise : () => promise;
	const toastPromise = toast.promise(async () => {
		await waitForNextPaint();
		return run();
	}, {
		loading: `${getAssetLabel({ count: filesCount })} uploaden...`,
		success: ({ uploadedCount, assetNames }) => {
			if (uploadedCount === 1) {
				const assetName = assetNames?.[0];
				return assetName
					? `${assetName} is geüpload`
					: "1 mediabestand is geüpload";
			}

			if (uploadedCount > 1) {
				return `${uploadedCount} mediabestanden zijn geüpload`;
			}

			return "Er zijn geen mediabestanden geüpload";
		},
		error: `Uploaden mislukt: ${getAssetLabel({ count: filesCount })}`,
	});

	return toastPromise.unwrap();
}
