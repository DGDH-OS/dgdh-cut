import { orgContextFromCookies } from "@/lib/suite-auth/context";
import { BedrijfWisselen } from "./bedrijf-wisselen";

const SUITE_ORG_POST = () =>
	`${(process.env.SUITE_LOGIN_URL ?? "https://id.dgdh-os.com/login").replace(/\/login\/?$/, "")}/api/organization`;

/** Smalle balk bovenin: actief bedrijf, en bij 2+ bedrijven met recht op CUT de wisselaar. */
export async function BedrijfBalk() {
	const ctx = await orgContextFromCookies().catch(() => null);
	if (!ctx || ctx.choice.kind !== "ok") return null;
	const { active, options } = ctx.choice;
	return (
		<div
			data-testid="bedrijf-balk"
			className="cut-org dgdh-shell-top border-border bg-background text-muted-foreground flex min-h-10 items-center justify-between gap-4 border-b px-8 py-1 text-sm"
		>
			<span className="dgdh-lockup">
				<svg className="dgdh-lockup__mark" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
					<rect width="1000" height="1000" fill="#4A1D20" />
					<text x="509" y="434" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="500" fontSize="330" letterSpacing="18" fill="#FBF9F6">DG</text>
					<text x="509" y="774" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="500" fontSize="330" letterSpacing="18" fill="#FBF9F6">DH</text>
				</svg>
				<span className="dgdh-lockup__name">CUT</span>
			</span>
			<span className="cut-org__actief">
				<span className="text-bronze-text uppercase tracking-wide text-xs">Bedrijf</span>{" "}
				<span className="text-foreground" data-testid="bedrijf-actief">{active.name}</span>
			</span>
			{options.length > 1 && (
				<div className="dgdh-shell-end">
					<BedrijfWisselen
						opties={options.map((o) => ({ id: o.organization_id, name: o.name }))}
						actief={active.organization_id}
						postUrl={SUITE_ORG_POST()}
						origin={process.env.CUT_APP_URL ?? "https://studio.dgdh-os.com"}
					/>
				</div>
			)}
		</div>
	);
}
