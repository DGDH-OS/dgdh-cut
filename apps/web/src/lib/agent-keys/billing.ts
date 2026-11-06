import type { AgentKeyRecord } from "./keys";
import type { Price } from "./pricing";
import type { UsageEvent } from "./store";

/** Renders are billed only for accepted exports. A pending render auto-accepts after this window. */
export const AUTO_ACCEPT_MS = 24 * 3600 * 1000;

export type EffState = "final" | "pending" | "accepted" | "auto_accepted" | "voided";
export type EffEvent = UsageEvent & { eff: EffState; auto_accept_at?: string };

/**
 * Resolve the append-only event stream into effective states. Events are never mutated:
 *  - a gated render is written as `pending`;
 *  - `accept_export` appends a resolution event (tool "accept_export", ref = render event id, state accepted|voided);
 *  - a pending render without resolution becomes `auto_accepted` once AUTO_ACCEPT_MS passed.
 */
export function effective(events: UsageEvent[], now = Date.now()): EffEvent[] {
	const resolution = new Map<string, "accepted" | "voided">();
	for (const e of events) if (e.ref && (e.state === "accepted" || e.state === "voided")) resolution.set(e.ref, e.state);
	const out: EffEvent[] = [];
	for (const e of events) {
		if (e.ref) continue; // resolution events carry no money
		if (e.state !== "pending") { out.push({ ...e, eff: e.state ?? "final" }); continue; }
		const r = resolution.get(e.id);
		const due = new Date(e.ts).getTime() + AUTO_ACCEPT_MS;
		out.push({ ...e, eff: r ?? (now >= due ? "auto_accepted" : "pending"), auto_accept_at: new Date(due).toISOString() });
	}
	return out;
}

/** Counts toward budgets: everything except voided and failed calls (pending is reserved conservatively). */
export const counts = (e: EffEvent) => e.eff !== "voided" && e.status === "ok";

export const monthStartIso = (now = Date.now()) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(); };
export const dayStartIso = (now = Date.now()) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString(); };
const nextMonthIso = (now = Date.now()) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString(); };
const nextDayIso = (now = Date.now()) => { const d = new Date(now); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString(); };
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export type BudgetState = {
	limits: { eur_month: number | null; units_day: number | null };
	spent: { eur_month: number; units_day: number; pending_eur: number };
	remaining: { eur_month: number | null; units_day: number | null };
	resets: { month: string; day: string };
};

export function budgetState(key: Pick<AgentKeyRecord, "budget_eur_month" | "budget_units_day">, events: UsageEvent[], now = Date.now()): BudgetState {
	const eff = effective(events, now).filter(counts);
	const ms = monthStartIso(now), ds = dayStartIso(now);
	const eur = r6(eff.filter((e) => e.ts >= ms).reduce((a, e) => a + (e.eur ?? 0), 0));
	const units = r6(eff.filter((e) => e.ts >= ds).reduce((a, e) => a + (e.units ?? 0), 0));
	const pending = r6(eff.filter((e) => e.eff === "pending").reduce((a, e) => a + (e.eur ?? 0), 0));
	const lim = { eur_month: key.budget_eur_month ?? null, units_day: key.budget_units_day ?? null };
	return {
		limits: lim,
		spent: { eur_month: eur, units_day: units, pending_eur: pending },
		remaining: { eur_month: lim.eur_month == null ? null : r6(Math.max(0, lim.eur_month - eur)), units_day: lim.units_day == null ? null : r6(Math.max(0, lim.units_day - units)) },
		resets: { month: nextMonthIso(now), day: nextDayIso(now) },
	};
}

export type BudgetVerdict =
	| { ok: true }
	| { ok: false; status: 402 | 429; body: Record<string, unknown>; headers?: Record<string, string> };

/** Pre-flight check: would this call push the key over its monthly EUR or daily unit cap? */
export function checkBudget(b: BudgetState, price: Price, now = Date.now()): BudgetVerdict {
	const { eur_month, units_day } = b.limits;
	if (eur_month != null && b.spent.eur_month + price.eur > eur_month + 1e-9)
		return { ok: false, status: 402, body: {
			ok: false, error: "budget_exceeded",
			message: `Monthly budget of EUR ${eur_month} reached: spent/reserved EUR ${b.spent.eur_month}, this call would cost EUR ${price.eur}. Resets ${b.resets.month}. Raise the key budget or accept/void pending exports.`,
			budget: b, estimate: { eur: price.eur, units: price.units },
		} };
	if (units_day != null && b.spent.units_day + price.units > units_day + 1e-9)
		return { ok: false, status: 429, body: {
			ok: false, error: "daily_units_exceeded",
			message: `Daily limit of ${units_day} units reached: used ${b.spent.units_day}, this call needs ${price.units}. Resets ${b.resets.day}.`,
			budget: b, estimate: { eur: price.eur, units: price.units },
		}, headers: { "retry-after": String(Math.max(1, Math.ceil((new Date(b.resets.day).getTime() - now) / 1000))) } };
	return { ok: true };
}
