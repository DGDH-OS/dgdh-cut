import { NextRequest } from "next/server";
import { authenticateAgentAccess } from "@/lib/agent-keys/auth";
import { getProject, isUuid, listProjects, saveProject, validate } from "@/services/agent-import/server-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 8 * 1024 * 1024;
// Auth: Bearer API key with scope `editor`, or a Suite browser session (the /agent page). proxy.ts lets
// /api/agent/* through; every handler fails closed here. Projects are tenant-scoped to the caller's org.

export async function POST(request: NextRequest) {
	const auth = await authenticateAgentAccess(request, "editor");
	if (!auth.ok) return auth.response;
	if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return Response.json({ ok: false, error: "body too large (max 8 MB)" }, { status: 413 });
	const result = validate(await request.json().catch(() => null));
	if (typeof result === "string") return Response.json({ ok: false, error: result }, { status: 400 });
	const saved = await saveProject(result, { org: auth.org, via: auth.via });
	if (saved === "forbidden") return Response.json({ ok: false, error: "project id belongs to another account" }, { status: 403 });
	const id = saved.project.metadata.id;
	return Response.json({ ok: true, id, revision: saved.revision, import: `/agent?id=${id}` });
}

export async function GET(request: NextRequest) {
	const auth = await authenticateAgentAccess(request, "editor");
	if (!auth.ok) return auth.response;
	const access = { org: auth.org, via: auth.via };
	const id = request.nextUrl.searchParams.get("id");
	if (id) {
		if (!isUuid(id)) return Response.json({ ok: false, error: "bad id" }, { status: 400 });
		const p = await getProject(id, access);
		if (p === "forbidden" || !p) return Response.json({ ok: false, error: "not found" }, { status: 404 });
		return Response.json(p);
	}
	return Response.json({ ok: true, items: await listProjects(access) });
}
