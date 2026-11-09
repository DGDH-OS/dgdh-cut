import type { Metadata } from "next";
import { orgContextFromCookies } from "@/lib/suite-auth/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Geen toegang | DGDH CUT", robots: { index: false } };

const SUITE = "https://id.dgdh-os.com/";

export default async function GeenToegang() {
	const ctx = await orgContextFromCookies().catch(() => null);
	// Heeft de gebruiker intussen toch recht (bijv. na bedrijfswissel), dan direct door naar de app.
	const naam = ctx && ctx.choice.kind === "no-access" ? ctx.choice.org?.name : null;
	return (
		<main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-6">
			<p className="text-bronze-text text-xs uppercase tracking-widest">DGDH CUT</p>
			<h1 className="text-3xl font-medium tracking-tight" data-testid="geen-toegang-titel">
				Geen toegang tot CUT{naam ? ` voor ${naam}` : ""}
			</h1>
			<p className="text-muted-foreground">
				Dit bedrijf heeft geen actief abonnement op DGDH CUT. Kies in de Suite een ander bedrijf of activeer CUT voor dit bedrijf.
			</p>
			<p>
				<a href={SUITE} className="underline underline-offset-4" data-testid="naar-suite">Terug naar de DGDH Suite</a>
			</p>
		</main>
	);
}
