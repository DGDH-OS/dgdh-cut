// Suite-login gate config (pattern copied from DGDH CALL). No secrets here: only env names.

const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** Dev-only bypass: needs CUT_DEV_AUTH=1, NODE_ENV!=production AND a localhost CUT_APP_URL. */
export function devAuthEnabled(): boolean {
	return (
		process.env.CUT_DEV_AUTH === "1" &&
		process.env.NODE_ENV !== "production" &&
		LOCAL_URL.test(process.env.CUT_APP_URL ?? "")
	);
}

export const suiteLoginUrl = () =>
	process.env.SUITE_LOGIN_URL ?? "https://id.dgdh-os.com/login";

export const appUrl = () => (process.env.CUT_APP_URL ?? "").replace(/\/$/, "");

/** Only static assets and the container healthcheck are reachable without a session. */
export function isPublicPath(pathname: string): boolean {
	if (pathname === "/api/health") return true;
	if (pathname.startsWith("/_next/static/")) return true;
	if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
	return /^\/(fonts|icons|logos|flags|effects)\//.test(pathname);
}
