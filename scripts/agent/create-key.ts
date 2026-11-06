// Admin: mint a CUT agent API key without the browser (uses the same store as the app).
// bun scripts/agent/create-key.ts --org <suite-user-id> --name "Klant X" [--scopes render,media:read] [--rpm 60] [--budget-eur-month 25] [--budget-units-day 500]
import { ALL_SCOPES, generateKey, type Scope } from "../../apps/web/src/lib/agent-keys/keys";
import { getStore } from "../../apps/web/src/lib/agent-keys/store";

const a = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const org = a("org"), name = a("name") ?? "cli";
if (!org) { console.error("--org required"); process.exit(1); }
const scopes = (a("scopes")?.split(",") ?? [...ALL_SCOPES]) as Scope[];
const { key, prefix, hash } = generateKey();
const rec = await getStore().create({ org, name, scopes, rate_limit_per_min: Number(a("rpm") ?? 60), budget_eur_month: a("budget-eur-month") ? Number(a("budget-eur-month")) : null, budget_units_day: a("budget-units-day") ? Number(a("budget-units-day")) : null, key_prefix: prefix, key_hash: hash });
console.log(JSON.stringify({ key, id: rec.id, org, scopes, budget_eur_month: rec.budget_eur_month ?? null, budget_units_day: rec.budget_units_day ?? null }));
