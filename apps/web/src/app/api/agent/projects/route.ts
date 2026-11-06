import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INBOX =
	process.env.CUT_AGENT_INBOX || join(process.cwd(), ".agent-inbox");
const SCHEMA = "dgdh-cut-agent-project/v1";
const UUID = /^[0-9a-f-]{36}$/i;

type AgentPayload = {
	schema: string;
	project: { metadata: { id: string; name: string; duration: number; createdAt: string }; scenes: unknown[] };
	media: { id: string; file: string }[];
};

function validate(body: unknown): AgentPayload | string {
	const b = body as Partial<AgentPayload> | null;
	if (!b || b.schema !== SCHEMA) return `schema must be "${SCHEMA}"`;
	const id = b.project?.metadata?.id;
	if (!id || !UUID.test(id)) return "project.metadata.id must be a UUID";
	if (!Array.isArray(b.project?.scenes) || b.project.scenes.length === 0)
		return "project.scenes must be a non-empty array";
	if (!Array.isArray(b.media)) return "media must be an array";
	for (const m of b.media)
		if (!m?.id || !m?.file || /[\\/]|\.\./.test(m.file))
			return "media[] needs id and a plain engine media-bin file name";
	return b as AgentPayload;
}

export async function POST(request: NextRequest) {
	const body = await request.json().catch(() => null);
	const result = validate(body);
	if (typeof result === "string")
		return Response.json({ ok: false, error: result }, { status: 400 });
	await mkdir(INBOX, { recursive: true });
	const id = result.project.metadata.id;
	await writeFile(join(INBOX, `${id}.json`), JSON.stringify(result));
	return Response.json({ ok: true, id, import: `/agent?id=${id}` });
}

export async function GET(request: NextRequest) {
	const id = request.nextUrl.searchParams.get("id");
	if (id) {
		if (!UUID.test(id))
			return Response.json({ ok: false, error: "bad id" }, { status: 400 });
		try {
			return Response.json(
				JSON.parse(await readFile(join(INBOX, `${id}.json`), "utf8")),
			);
		} catch {
			return Response.json({ ok: false, error: "not found" }, { status: 404 });
		}
	}
	const files = await readdir(INBOX).catch(() => [] as string[]);
	const items = [];
	for (const f of files.filter((n) => n.endsWith(".json"))) {
		try {
			const p = JSON.parse(await readFile(join(INBOX, f), "utf8")) as AgentPayload;
			items.push({
				id: p.project.metadata.id,
				name: p.project.metadata.name,
				duration: p.project.metadata.duration,
				createdAt: p.project.metadata.createdAt,
				mediaCount: p.media.length,
			});
		} catch {
			/* skip malformed */
		}
	}
	items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	return Response.json({ ok: true, items });
}
