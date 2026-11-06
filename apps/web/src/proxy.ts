import { NextResponse, type NextRequest } from "next/server";
import {
	appUrl,
	devAuthEnabled,
	isPublicPath,
	suiteLoginUrl,
} from "@/lib/suite-auth/config";
import { getSuiteSession } from "@/lib/suite-auth/session";

// Suite-login gate for DGDH CUT. Protects every route except statics + /api/health,
// including /api/engine and /api/export (401 JSON instead of redirect for /api/*).
export async function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	if (isPublicPath(pathname)) return NextResponse.next();
	if (devAuthEnabled()) return NextResponse.next();

	let response = NextResponse.next({ request });
	const session = await getSuiteSession(request, (values) => {
		response = NextResponse.next({ request });
		for (const { name, value, options } of values)
			response.cookies.set(name, value, options);
	});

	if (!session) {
		if (pathname.startsWith("/api/")) {
			return Response.json({ error: "unauthorized" }, { status: 401 });
		}
		// Behind Traefik request.url carries the internal origin: build return URL from CUT_APP_URL.
		const back = `${appUrl()}${pathname}${search}`;
		return NextResponse.redirect(
			`${suiteLoginUrl()}?next=${encodeURIComponent(back)}`,
		);
	}
	response.headers.set("Cache-Control", "private, no-store");
	return response;
}

export const config = {
	matcher: ["/((?!_next/static|favicon.ico).*)"],
};
