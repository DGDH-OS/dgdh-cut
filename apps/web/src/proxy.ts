import { NextResponse, type NextRequest } from "next/server";
import {
	appUrl,
	devAuthEnabled,
	isPublicPath,
	suiteLoginUrl,
} from "@/lib/suite-auth/config";
import { getSuiteSession } from "@/lib/suite-auth/session";
import { activeWorkspaceOrg, contextFor } from "@/lib/suite-auth/context";
import { SUITE_ORG_COOKIE } from "@/lib/suite-auth/org";

const isAgentApiPath = (p: string) =>
	p === "/api/mcp" || p.startsWith("/api/agent/") || (p.startsWith("/api/v1/") && !p.startsWith("/api/v1/keys"));

// Suite-login gate for DGDH CUT. Protects every route except statics + /api/health,
// including /api/engine and /api/export (401 JSON instead of redirect for /api/*).
export async function proxy(request: NextRequest) {
	const { pathname, search } = request.nextUrl;
	if (isPublicPath(pathname)) return NextResponse.next();
	if (devAuthEnabled()) return NextResponse.next();
	// Agent surface: authenticated by Bearer API key inside the route handlers (fail closed there),
	// not by browser session (/api/agent/* accepts a key OR a Suite session, checked in the route). /api/v1/keys stays session-only (key management by Suite users).
	if (isAgentApiPath(pathname)) return NextResponse.next();

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

	// Autorisatie (contract par. 2): lidmaatschap + recht op app `cut`. De cookie suite-organization is alleen een voorkeur.
	if (pathname === "/geen-toegang") return response;
	let ctx: Awaited<ReturnType<typeof contextFor>>;
	try {
		ctx = await contextFor(session.client, session.userId, session.email, request.cookies.get(SUITE_ORG_COOKIE)?.value);
		if (ctx.choice.kind === "ok") await activeWorkspaceOrg(ctx); // idempotente auto-onboarding van de tenant
	} catch {
		// Fail closed: nooit doorlaten zonder gecontroleerd recht.
		if (pathname.startsWith("/api/")) return Response.json({ error: "controle tijdelijk niet beschikbaar" }, { status: 503, headers: { "retry-after": "15" } });
		return new Response("Controle tijdelijk niet beschikbaar. Probeer het zo opnieuw.", { status: 503, headers: { "retry-after": "15", "content-type": "text/plain; charset=utf-8" } });
	}
	if (ctx.choice.kind !== "ok") {
		if (pathname.startsWith("/api/")) return Response.json({ error: "geen toegang tot CUT voor dit bedrijf" }, { status: 403 });
		return NextResponse.redirect(`${appUrl()}/geen-toegang`);
	}
	// Geen landing als poort: ingelogd met recht = direct het projectenoverzicht.
	if (pathname === "/") {
		const redirect = NextResponse.redirect(`${appUrl()}/projects`);
		for (const c of response.cookies.getAll()) redirect.cookies.set(c);
		redirect.headers.set("Cache-Control", "private, no-store");
		return redirect;
	}
	return response;
}

export const config = {
	matcher: ["/((?!_next/static|favicon.ico).*)"],
};
