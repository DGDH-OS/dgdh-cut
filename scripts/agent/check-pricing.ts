// Verifies apps/web/src/lib/agent-keys/pricing.ts against tools/pricing/pricing.json (apps.cut.units).
// bun scripts/agent/check-pricing.ts [path/to/pricing.json]   (default: <1. OPS>/tools/pricing/pricing.json)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PRICING_VERSION, UNIT_RATES } from "../../apps/web/src/lib/agent-keys/pricing";
const path = process.argv[2] ?? process.env.PRICING_JSON ?? fileURLToPath(new URL("../../../../../tools/pricing/pricing.json", import.meta.url));
const j = JSON.parse(readFileSync(path, "utf8"));
let bad = 0;
for (const [k, v] of Object.entries(UNIT_RATES)) {
	const src = j.apps.cut.units[k]?.payg_eur;
	if (src !== v.payg_eur) { bad++; console.error(`MISMATCH ${k}: code ${v.payg_eur} vs pricing.json ${src}`); }
}
if (j.meta.version !== PRICING_VERSION) { bad++; console.error(`version: code ${PRICING_VERSION} vs pricing.json ${j.meta.version}`); }
console.log(bad ? `${bad} mismatch(es)` : `pricing.ts matches pricing.json ${j.meta.version}`);
process.exit(bad ? 1 : 0);
