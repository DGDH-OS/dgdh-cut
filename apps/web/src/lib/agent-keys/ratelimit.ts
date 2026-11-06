// Fixed-window per-key limiter (in-memory, per instance). Single Coolify container => adequate;
// swap for Redis if CUT is ever scaled horizontally.
const windows = new Map<string, { start: number; n: number }>();

export function rateLimit(keyId: string, perMin: number): { ok: boolean; retryAfterSec: number } {
	const now = Date.now();
	const w = windows.get(keyId);
	if (!w || now - w.start >= 60_000) {
		windows.set(keyId, { start: now, n: 1 });
		return { ok: true, retryAfterSec: 0 };
	}
	if (w.n >= perMin) return { ok: false, retryAfterSec: Math.ceil((60_000 - (now - w.start)) / 1000) };
	w.n++;
	return { ok: true, retryAfterSec: 0 };
}
