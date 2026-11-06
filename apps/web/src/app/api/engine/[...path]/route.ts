import { NextRequest } from "next/server";

export const runtime = "nodejs";

const CUT_ENGINE_URL = (
	process.env.CUT_ENGINE_URL || "http://localhost:8765"
).replace(/\/$/, "");

async function proxy(
	request: NextRequest,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path } = await params;
	const target = `${CUT_ENGINE_URL}/${path.join("/")}${request.nextUrl.search}`;
	const hasBody = !["GET", "HEAD"].includes(request.method);
	const upstream = await fetch(target, {
		method: request.method,
		headers: {
			"content-type": request.headers.get("content-type") ?? "application/json",
		},
		body: hasBody ? await request.arrayBuffer() : undefined,
	}).catch(() => null);
	if (!upstream) {
		return Response.json({ error: "CUT Engine unreachable" }, { status: 502 });
	}
	return new Response(upstream.body, {
		status: upstream.status,
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/octet-stream",
		},
	});
}

export const GET = proxy;
export const POST = proxy;
