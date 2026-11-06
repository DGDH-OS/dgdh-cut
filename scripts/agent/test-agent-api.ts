#!/usr/bin/env bun
/**
 * End-to-end test of the CUT agent layer with the official MCP SDK client + REST.
 *   CUT_URL=http://localhost:3199 CUT_KEYS_DIR=/tmp/cutkeys CUT_AGENT_INBOX=/tmp/cutinbox bun scripts/agent/test-agent-api.ts
 * The Next server must run with the same CUT_AGENT_KEYS_DIR (=CUT_KEYS_DIR) and CUT_AGENT_INBOX, and the
 * engine on CUT_ENGINE_URL (default :8765). Mints its own keys via the file store; no secrets needed.
 * Covers: tools/list, calls, dry_run + estimate, budget 402/429, invalid key 401, usage events,
 * accept_export (accept / void), /api/agent/* auth, project store + edit_timeline.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const URL_ = process.env.CUT_URL ?? "http://localhost:3199";
const KEYS_DIR = process.env.CUT_KEYS_DIR ?? process.env.CUT_AGENT_KEYS_DIR!;
process.env.CUT_AGENT_KEYS_DIR = KEYS_DIR;
const { generateKey } = await import("../../apps/web/src/lib/agent-keys/keys");
const { getStore } = await import("../../apps/web/src/lib/agent-keys/store");

let pass = 0, fail = 0;
const ok = (c: unknown, msg: string, extra?: unknown) => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"} ${msg}${c ? "" : ` :: ${JSON.stringify(extra)?.slice(0, 400)}`}`); };

async function mint(name: string, budget: { eur?: number; units?: number } = {}) {
	const g = generateKey();
	await getStore().create({ org: "test-org", name, scopes: ["media:read", "media:write", "render", "transcribe", "voice", "editor", "publish"], rate_limit_per_min: 600, key_prefix: g.prefix, key_hash: g.hash, budget_eur_month: budget.eur ?? null, budget_units_day: budget.units ?? null });
	return g.key;
}
const mcp = async (key: string) => {
	const c = new Client({ name: "agent-test", version: "1" });
	await c.connect(new StreamableHTTPClientTransport(new URL(`${URL_}/api/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
	return c;
};
const call = async (c: Client, name: string, args: object) => { const r: any = await c.callTool({ name, arguments: args }); return { isError: !!r.isError, body: JSON.parse(r.content[0].text) }; };
const rest = async (key: string | null, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") => {
	const r = await fetch(`${URL_}${path}`, { method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
	return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) as any };
};

// ---- 1. invalid / missing key
ok((await rest("cut_live_nope", "/api/v1/tools")).status === 401, "invalid key -> 401 (REST)");
ok((await rest(null, "/api/v1/tools")).status === 401, "no key -> 401 (REST)");
ok((await rest("cut_live_nope", "/api/agent/projects")).status === 401, "invalid key -> 401 on /api/agent/projects");
ok((await rest(null, "/api/agent/projects")).status === 401, "no auth -> 401 on /api/agent/projects");
let bad = false;
try { await mcp("cut_live_nope"); } catch { bad = true; }
ok(bad, "invalid key -> MCP connect rejected");

// ---- 2. tools/list + real calls over MCP
const key = await mint("full");
const c = await mcp(key);
const { tools } = await c.listTools();
const names = tools.map((t) => t.name);
console.log("TOOLS", names.join(","));
for (const n of ["edit_timeline", "detect_scenes", "measure_loudness", "normalize_loudness", "get_project", "list_projects", "publish_to_social", "accept_export", "estimate"])
	ok(names.includes(n), `tools/list has ${n}`);
ok(tools.find((t) => t.name === "compose")?.inputSchema.properties?.dry_run, "compose schema exposes dry_run");

const media = await call(c, "list_media", {});
ok(!media.isError && Array.isArray(media.body.items), "list_media", media.body);
const vid = media.body.items?.find((i: any) => i.kind === "video" && i.duration_s > 2 && i.duration_s < 60);
ok(!!vid, "engine media-bin has a short video to test with", media.body.items?.slice(0, 3));
const cat = await call(c, "list_catalog", { kind: "luts" });
ok(!cat.isError, "list_catalog luts", cat.body);

// ---- 3. dry_run + estimate: priced, nothing executed, no usage event
const usageBefore = (await rest(key, "/api/v1/usage")).body;
const dry = await call(c, "grade", { file: vid.file, lut: "cinematic", dry_run: true });
const exp = +(vid.duration_s / 60).toFixed(6);
ok(dry.body.dry_run === true && dry.body.executed === false, "grade dry_run flagged", dry.body);
ok(dry.body.estimate?.lines?.[0]?.unit === "export_min" && Math.abs(dry.body.estimate.eur - Math.max(0.1, Math.ceil(exp * 10) / 10) * 0.04) < 1e-6, `grade dry_run price = ceil01(${vid.duration_s}s/60) x EUR 0.04`, dry.body.estimate);
const est = await call(c, "estimate", { tool: "voiceover", args: { text: "x".repeat(2500) } });
ok(est.body.estimate?.units === 2.5 && Math.abs(est.body.estimate.eur - 0.375) < 1e-9, "estimate voiceover 2500 chars = 2.5 units, EUR 0.375", est.body);
const dryRest = await rest(key, "/api/v1/tools/karaoke", { file: vid.file, dry_run: true });
ok(dryRest.status === 200 && dryRest.body.estimate.lines.length === 2 && dryRest.body.estimate.gated, "REST dry_run karaoke = transcribe_min + export_min, gated", dryRest.body);
const usageAfterDry = (await rest(key, "/api/v1/usage")).body;
ok(JSON.stringify(usageBefore.by_state) === JSON.stringify(usageAfterDry.by_state), "dry runs wrote no billable usage");

// ---- 4. real render -> pending usage event -> accept / void
const g1 = await call(c, "grade", { file: vid.file, lut: "cinematic" });
ok(!g1.isError && g1.body.download_url && g1.body.usage?.state === "pending", "grade executed, usage pending", g1.body);
const ev1 = g1.body.usage?.event_id;
let u = (await rest(key, "/api/v1/usage")).body;
ok(u.by_state?.pending?.events >= 1 && !u.by_tool.some((t: any) => t.tool === "grade"), "pending render is not in billable totals yet", u);
const acc = await call(c, "accept_export", { usage_event_id: ev1, accepted: true });
ok(!acc.isError && acc.body.state === "accepted" && acc.body.billed_eur > 0, "accept_export accepted -> billed", acc.body);
u = (await rest(key, "/api/v1/usage")).body;
ok(u.by_tool.find((t: any) => t.tool === "grade")?.eur > 0, "accepted render now in billable totals", u.by_tool);
const again = await call(c, "accept_export", { usage_event_id: ev1, accepted: false });
ok(again.isError, "cannot flip an accepted export", again.body);
const g2 = await call(c, "reframe", { file: vid.file, output_size: "1080x1920" });
const voided = await call(c, "accept_export", { usage_event_id: g2.body.usage?.event_id, accepted: false });
ok(voided.body.state === "voided" && voided.body.billed_eur === 0, "accept_export accepted=false -> voided, EUR 0", voided.body);
u = (await rest(key, "/api/v1/usage")).body;
ok(u.by_state?.voided?.events >= 1 && !u.by_tool.some((t: any) => t.tool === "reframe"), "voided render excluded from totals", u);

// usage events on disk (append-only jsonl)
const lines = readFileSync(join(KEYS_DIR, "usage.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const gradeEv = lines.find((e) => e.id === ev1);
ok(gradeEv && gradeEv.state === "pending" && gradeEv.tool === "grade" && gradeEv.eur > 0 && gradeEv.unit === "export_min", "usage.jsonl has priced grade event (append-only, original stays 'pending')", gradeEv);
ok(lines.some((e) => e.ref === ev1 && e.state === "accepted") && lines.some((e) => e.ref === g2.body.usage?.event_id && e.state === "voided"), "resolution events appended (accepted + voided)");

// ---- 5. analysis tools on the real engine
const sc = await call(c, "detect_scenes", { file: vid.file });
ok(!sc.isError && typeof sc.body.scene_count === "number" || Array.isArray(sc.body.scenes), "detect_scenes", sc.body);
const ml = await call(c, "measure_loudness", { file: vid.file });
ok(!ml.isError && typeof ml.body.input_lufs === "number", "measure_loudness returns LUFS", ml.body);
const nl = await call(c, "normalize_loudness", { file: vid.file, audio_only: true });
ok(!nl.isError && nl.body.usage?.state === "pending", "normalize_loudness executed (pending)", nl.body);
if (nl.body.usage?.event_id) await call(c, "accept_export", { usage_event_id: nl.body.usage.event_id, accepted: false });
const pub = await call(c, "publish_to_social", { file: vid.file, platform: "instagram", text: "test" });
ok(pub.isError && /SOCIAL_API|CUT_PUBLIC_URL|publish/i.test(pub.body.error ?? ""), "publish_to_social reaches the engine (clear config error expected locally, never publishes)", pub.body);

// ---- 6. budget: per-key EUR/month + units/day
const small = await mint("tiny-eur", { eur: 0.05 });
const sc1 = await mcp(small);
const b1 = await call(sc1, "grade", { file: vid.file, lut: "cinematic" }); // ~0.004 EUR
ok(!b1.isError, "call within budget runs", b1.body);
const vo = await rest(small, "/api/v1/tools/voiceover", { text: "x".repeat(1000) }); // EUR 0.15 > 0.05
ok(vo.status === 402 && vo.body.error === "budget_exceeded" && /EUR 0\.05/.test(vo.body.message), "over monthly EUR budget -> 402 budget_exceeded", vo.body);
const voM = await call(sc1, "voiceover", { text: "x".repeat(1000) });
ok(voM.isError && voM.body.error === "budget_exceeded", "same over MCP (isError)", voM.body);
const evBefore = readFileSync(join(KEYS_DIR, "usage.jsonl"), "utf8").split("\n").filter(Boolean).length;
const dryB = await rest(small, "/api/v1/tools/voiceover", { text: "x".repeat(1000), dry_run: true });
ok(dryB.status === 200 && dryB.body.would_be_allowed === false && dryB.body.budget.remaining.eur_month < 0.05, "dry_run reports would_be_allowed=false + remaining budget", dryB.body);
ok(readFileSync(join(KEYS_DIR, "usage.jsonl"), "utf8").split("\n").filter(Boolean).length === evBefore, "blocked + dry-run calls wrote no usage events");

const units = await mint("tiny-units", { units: 0.3 });
const r1 = await rest(units, "/api/v1/tools/grade", { file: vid.file, lut: "cinematic" }); // 0.1 unit
ok(r1.status === 200, "daily units: first call ok", r1.body);
await rest(units, "/api/v1/tools/grade", { file: vid.file, lut: "cinematic" });
await rest(units, "/api/v1/tools/grade", { file: vid.file, lut: "cinematic" });
const r4 = await rest(units, "/api/v1/tools/grade", { file: vid.file, lut: "cinematic" });
ok(r4.status === 429 && r4.body.error === "daily_units_exceeded" && Number(r4.headers.get("retry-after")) > 0, "units/day exceeded -> 429 + Retry-After", { s: r4.status, b: r4.body });
// voiding frees the reserved budget
const freed = r1.body.usage?.event_id;
await rest(units, "/api/v1/tools/accept_export", { usage_event_id: freed, accepted: false });
ok((await rest(units, "/api/v1/tools/grade", { file: vid.file, lut: "cinematic", dry_run: true })).body.would_be_allowed === true, "voiding an export frees budget");

// ---- 7. /api/agent projects behind auth + server-side store + edit_timeline
const proj = JSON.parse(readFileSync(new URL("./fixtures/agent-project.json", import.meta.url), "utf8"));
proj.project.metadata.id = crypto.randomUUID();
const put = await rest(key, "/api/agent/projects", proj);
ok(put.status === 200 && put.body.revision === 1, "POST /api/agent/projects with key stores project", put.body);
const pid = put.body.id;
ok((await rest(null, `/api/agent/projects?id=${pid}`)).status === 401, "GET project without auth -> 401");
const other = await (async () => { const g = generateKey(); await getStore().create({ org: "other-org", name: "o", scopes: ["editor"], rate_limit_per_min: 60, key_prefix: g.prefix, key_hash: g.hash }); return g.key; })();
ok((await rest(other, `/api/agent/projects?id=${pid}`)).status === 404, "other org cannot read the project (tenant isolation)");
ok((await rest(other, "/api/agent/projects", proj)).status === 403, "other org cannot overwrite the project");
const lp = await call(c, "list_projects", {});
ok(lp.body.projects?.some((p: any) => p.id === pid), "list_projects shows it", lp.body);
const gp = await call(c, "get_project", { project_id: pid });
const main = gp.body.project?.tracks?.[0]?.elements;
ok(main?.length >= 1, "get_project summary lists elements with ids", gp.body);
const first = main[0];
const dur0 = gp.body.project.duration_s;
const e1 = await call(c, "edit_timeline", { project_id: pid, expected_revision: 1, operations: [{ op: "cut", element_id: first.id, at: first.start_s + first.duration_s / 2 }] });
ok(!e1.isError && e1.body.project.revision === 2 && e1.body.project.tracks[0].elements.length === main.length + 1, "edit_timeline cut splits a clip (revision 2)", e1.body);
const els = e1.body.project.tracks[0].elements;
const e2 = await call(c, "edit_timeline", { project_id: pid, operations: [{ op: "ripple_delete", element_id: els[1].id }, { op: "set_volume", element_id: els[0].id, volume_db: -6 }, { op: "add_text", text: "Hallo", start: 0, end: 1 }, { op: "trim", element_id: els[0].id, out: Math.max(0.5, els[0].out_s - 0.1) }] });
ok(!e2.isError && e2.body.project.duration_s < dur0 + 0.01 && e2.body.project.duration_s < e1.body.project.duration_s, "ripple_delete shortens project; set_volume/add_text/trim applied", e2.body);
const stale = await call(c, "edit_timeline", { project_id: pid, expected_revision: 1, operations: [{ op: "set_volume", element_id: els[0].id, volume_db: 0 }] });
ok(stale.isError && /revision conflict/.test(stale.body.error), "stale expected_revision rejected", stale.body);
const atomic = await call(c, "edit_timeline", { project_id: pid, operations: [{ op: "set_volume", element_id: els[0].id, volume_db: 3 }, { op: "ripple_delete", element_id: "nope" }] });
const after = await call(c, "get_project", { project_id: pid });
ok(atomic.isError && JSON.stringify(after.body.project.tracks).includes('"volume_db":-6'), "failed batch is atomic (no partial changes)", atomic.body);
const addc = await call(c, "edit_timeline", { project_id: pid, operations: [{ op: "add_clip", file: vid.file }] });
ok(!addc.isError && addc.body.project.duration_s > e2.body.project.duration_s, "add_clip appends a clip from the media-bin", addc.body);
const raw = await rest(key, `/api/agent/projects?id=${pid}`);
ok(raw.status === 200 && raw.body.schema === "dgdh-cut-agent-project/v1" && raw.body.revision >= 4, "stored file stays dgdh-cut-agent-project/v1 (importable by /agent)", { s: raw.status, rev: raw.body?.revision });

// ---- 8. scope + usage still enforced
const ro = await (async () => { const g = generateKey(); await getStore().create({ org: "test-org", name: "ro", scopes: ["media:read"], rate_limit_per_min: 60, key_prefix: g.prefix, key_hash: g.hash }); return g.key; })();
ok((await rest(ro, "/api/v1/tools/grade", { file: vid.file })).status === 403, "missing scope -> 403");
ok((await rest(ro, "/api/agent/projects")).status === 403, "/api/agent/projects needs scope editor -> 403");

await c.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
