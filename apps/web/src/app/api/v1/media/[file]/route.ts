import { authenticate, hasScope } from "@/lib/agent-keys/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Key-protected download of a media-bin file (renders returned by tools link here).
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
	const auth = await authenticate(request);
	if (!auth.ok) return auth.response;
	if (!hasScope(auth.key, "media:read")) return Response.json({ ok: false, error: "missing scope media:read" }, { status: 403 });
	const { file } = await params;
	if (!/^[\w.-]+$/.test(file) || file.includes("..")) return Response.json({ ok: false, error: "bad file name" }, { status: 400 });
	const base = (process.env.CUT_ENGINE_URL || "http://localhost:8765").replace(/\/$/, "");
	const up = await fetch(`${base}/media/${encodeURIComponent(file)}`).catch(() => null);
	if (!up) return Response.json({ ok: false, error: "CUT Engine unreachable" }, { status: 502 });
	if (!up.ok) return Response.json({ ok: false, error: "not found" }, { status: up.status });
	return new Response(up.body, { headers: { "content-type": up.headers.get("content-type") ?? "application/octet-stream", "content-disposition": `attachment; filename="${file}"` } });
}
