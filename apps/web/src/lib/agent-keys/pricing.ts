/**
 * CUT price table. Source of truth: `1. OPS/tools/pricing/pricing.json` (apps.cut.units, version below).
 * CONCEPT prices (not live in Stripe, not approved by Ruben): used only to *preview* cost and to enforce
 * per-key budgets. Keep in sync when pricing.json changes (see scripts/agent/check-pricing.ts).
 */
export const PRICING_VERSION = "2026-11-06.1";
export const PRICING_STATUS = "CONCEPT";
export const CURRENCY = "EUR";

export const UNIT_RATES = {
	export_min: { payg_eur: 0.04, label: "export minute (output minutes rendered)" },
	transcribe_min: { payg_eur: 0.012, label: "transcription minute (input audio)" },
	vo_1k_chars: { payg_eur: 0.15, label: "voice-over per 1,000 characters (ElevenLabs v2 Multilingual)" },
	vo_fast_1k_chars: { payg_eur: 0.08, label: "voice-over per 1,000 characters (Flash/Turbo)" },
} as const;
export type UnitKey = keyof typeof UNIT_RATES;

export type PriceInput = { unit: UnitKey; quantity: number; basis: string; assumed?: boolean };
export type PriceLine = { unit: UnitKey; quantity: number; rate_eur: number; eur: number; basis: string; assumed?: boolean };
export type Price = {
	lines: PriceLine[];
	units: number; // sum of billable quantities (what `max units per day` counts)
	eur: number;
	/** true = billed only after accept_export (or 24h auto-accept); until then it is reserved against the budget. */
	gated: boolean;
	assumed: boolean; // true if any quantity is a fallback guess (e.g. engine unreachable)
	pricing_version: string;
	pricing_status: string;
};

/** metering.rounding in pricing.json: issuer rounds UP to 0.1 unit, min 0.1. */
export const roundUnits = (q: number) => Math.max(0.1, Math.ceil(q * 10 - 1e-9) / 10);
const eur6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function buildPrice(inputs: PriceInput[], gated: boolean): Price {
	const lines: PriceLine[] = inputs.map((i) => {
		const quantity = roundUnits(i.quantity);
		const rate = UNIT_RATES[i.unit].payg_eur;
		return { unit: i.unit, quantity, rate_eur: rate, eur: eur6(quantity * rate), basis: i.basis, ...(i.assumed ? { assumed: true } : {}) };
	});
	return {
		lines,
		units: eur6(lines.reduce((a, l) => a + l.quantity, 0)),
		eur: eur6(lines.reduce((a, l) => a + l.eur, 0)),
		gated: gated && lines.length > 0,
		assumed: lines.some((l) => l.assumed),
		pricing_version: PRICING_VERSION,
		pricing_status: PRICING_STATUS,
	};
}
