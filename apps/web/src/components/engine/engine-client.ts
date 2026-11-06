/** Browser-side helper: all CUT Engine calls go through /api/engine/* (same-origin proxy). */
export async function engineFetch<T = unknown>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`/api/engine/${path.replace(/^\//, "")}`, init);
	if (!res.ok) throw new Error(`CUT Engine ${path}: ${res.status}`);
	return (await res.json()) as T;
}

export const engineUrl = (path: string) =>
	`/api/engine/${path.replace(/^\//, "")}`;

/** POST JSON to the CUT Engine and surface the engine's own `error` field on failure. */
export async function enginePostJson<T extends { error?: string } = { error?: string }>(
	path: string,
	body: unknown,
): Promise<T> {
	const res = await fetch(engineUrl(path), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	const data = (await res.json().catch(() => ({}))) as T;
	if (!res.ok) {
		throw new Error(data.error || `CUT Engine ${path}: ${res.status}`);
	}
	return data;
}
