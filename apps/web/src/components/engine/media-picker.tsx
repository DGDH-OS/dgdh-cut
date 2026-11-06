"use client";

import { useCallback, useEffect, useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { engineFetch } from "./engine-client";

export type MediaItem = {
	file: string;
	url: string;
	kind: "image" | "video";
	bytes: number;
	duration_s?: number | null;
};

export function useMediaBin() {
	const [items, setItems] = useState<MediaItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await engineFetch<{ ok: boolean; items: MediaItem[] }>(
				"api/media-bin",
			);
			setItems(res.items ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "media-bin failed");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	return { items, loading, error, reload };
}

function formatDuration(seconds?: number | null): string {
	if (seconds == null) return "";
	const m = Math.floor(seconds / 60);
	const s = Math.round(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

export function MediaPicker({
	value,
	onValueChange,
	filter = "video",
	placeholder = "Select media...",
}: {
	value?: string;
	onValueChange: (file: string) => void;
	filter?: "video" | "image" | "all";
	placeholder?: string;
}) {
	const { items, loading, error } = useMediaBin();
	const filtered = items.filter(
		(item) => filter === "all" || item.kind === filter,
	);

	return (
		<Select value={value ?? ""} onValueChange={onValueChange} disabled={loading}>
			<SelectTrigger>
				<SelectValue
					placeholder={error ? "Engine niet bereikbaar" : placeholder}
				/>
			</SelectTrigger>
			<SelectContent>
				{filtered.map((item) => (
					<SelectItem key={item.file} value={item.file}>
						{item.file}
						{item.kind === "video" && item.duration_s != null
							? ` (${formatDuration(item.duration_s)})`
							: ""}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
