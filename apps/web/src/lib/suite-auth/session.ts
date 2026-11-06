import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export type SuiteSession = { userId: string; email: string | null };

/**
 * Validates the shared Suite session (cookie on .dgdh-os.com) with Supabase.
 * Requires a non-anonymous user at MFA level aal2, same bar as the rest of the Suite.
 * Refreshed cookies are written via `onCookies`.
 */
export async function getSuiteSession(
	request: NextRequest,
	onCookies: (
		values: { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] }[],
	) => void,
): Promise<SuiteSession | null> {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) return null; // fail closed
	const domain = process.env.AUTH_COOKIE_DOMAIN;
	const client = createServerClient(url, key, {
		cookieOptions: {
			path: "/",
			sameSite: "lax",
			secure: true,
			...(domain === ".dgdh-os.com" ? { domain } : {}),
		},
		cookies: {
			getAll: () => request.cookies.getAll(),
			setAll(values) {
				for (const { name, value } of values) request.cookies.set(name, value);
				onCookies(values);
			},
		},
	});
	const { data, error } = await client.auth.getUser();
	if (error || !data.user || data.user.is_anonymous) return null;
	const aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
	if (aal.data?.currentLevel !== "aal2") return null;
	return { userId: data.user.id, email: data.user.email ?? null };
}
