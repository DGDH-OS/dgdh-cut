// Server-side agent project store (file based, same inbox + format as before: dgdh-cut-agent-project/v1).
// Projects are owned by the key's org (= Suite user id) so /api/agent/* can be tenant-scoped.
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AGENT_SCHEMA } from "./ops";

const UUID = /^[0-9a-f-]{36}$/i;
export const inboxDir = () => process.env.CUT_AGENT_INBOX || join(process.cwd(), ".agent-inbox");
export const isUuid = (s: string) => UUID.test(s);

export type Access = { org: string; via: "key" | "session" };
export type StoredProject = { schema: string; project: any; media: any[]; engine?: unknown; owner?: string; revision?: number };

export function validate(body: unknown): StoredProject | string {
	const b = body as Partial<StoredProject> | null;
	if (!b || b.schema !== AGENT_SCHEMA) return `schema must be "${AGENT_SCHEMA}"`;
	const id = b.project?.metadata?.id;
	if (!id || !UUID.test(id)) return "project.metadata.id must be a UUID";
	if (!Array.isArray(b.project?.scenes) || b.project.scenes.length === 0) return "project.scenes must be a non-empty array";
	if (!Array.isArray(b.media)) return "media must be an array";
	for (const m of b.media) if (!m?.id || !m?.file || /[\\/]|\.\./.test(m.file)) return "media[] needs id and a plain engine media-bin file name";
	return b as StoredProject;
}

/** Legacy (ownerless) files were written before auth: browser sessions may still see them, API keys may not. */
export const canAccess = (p: StoredProject, a: Access) => (p.owner ? p.owner === a.org : a.via === "session");

async function readRaw(id: string): Promise<StoredProject | null> {
	try { return JSON.parse(await readFile(join(inboxDir(), `${id}.json`), "utf8")); } catch { return null; }
}

export async function getProject(id: string, a: Access): Promise<StoredProject | "forbidden" | null> {
	if (!UUID.test(id)) return null;
	const p = await readRaw(id);
	if (!p) return null;
	return canAccess(p, a) ? p : "forbidden";
}

async function write(p: StoredProject) {
	await mkdir(inboxDir(), { recursive: true });
	const f = join(inboxDir(), `${p.project.metadata.id}.json`);
	const tmp = `${f}.${process.pid}.tmp`;
	await writeFile(tmp, JSON.stringify(p));
	await rename(tmp, f);
}

/** Create or replace (same owner only). Returns "forbidden" if the id belongs to another org. */
export async function saveProject(p: StoredProject, a: Access): Promise<StoredProject | "forbidden"> {
	const prev = await readRaw(p.project.metadata.id);
	if (prev && !canAccess(prev, a)) return "forbidden";
	const saved = { ...p, owner: a.org, revision: (prev?.revision ?? 0) + 1 };
	await write(saved);
	return saved;
}

/** Optimistic update used by edit_timeline: fails if the revision moved. */
export async function updateProject(next: StoredProject, expectedRevision: number): Promise<StoredProject | "conflict"> {
	const cur = await readRaw(next.project.metadata.id);
	if (!cur || (cur.revision ?? 1) !== expectedRevision) return "conflict";
	const saved = { ...next, revision: expectedRevision + 1 };
	await write(saved);
	return saved;
}

export async function listProjects(a: Access) {
	const files = await readdir(inboxDir()).catch(() => [] as string[]);
	const items: { id: string; name: string; duration: number; createdAt: string; updatedAt: string; mediaCount: number; revision: number }[] = [];
	for (const f of files.filter((n) => n.endsWith(".json"))) {
		try {
			const p = JSON.parse(await readFile(join(inboxDir(), f), "utf8")) as StoredProject;
			if (!canAccess(p, a)) continue;
			const m = p.project.metadata;
			items.push({ id: m.id, name: m.name, duration: m.duration, createdAt: m.createdAt, updatedAt: m.updatedAt ?? m.createdAt, mediaCount: p.media.length, revision: p.revision ?? 1 });
		} catch { /* skip malformed */ }
	}
	return items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}
