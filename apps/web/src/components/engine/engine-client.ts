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
