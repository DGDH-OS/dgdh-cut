import Link from "next/link";
import { DEFAULT_LOGO_URL_LIGHT, DEFAULT_LOGO_URL } from "@/site/brand";

type Category = "resources" | "company";

interface FooterLink {
	label: string;
	href: string;
}

type CategoryLinks = Record<Category, FooterLink[]>;

const links: CategoryLinks = {
	resources: [
		{ label: "Roadmap", href: "/roadmap" },
		{ label: "Wijzigingslog", href: "/changelog" },
	],
	company: [
		{ label: "Privacy", href: "/privacy" },
		{ label: "Gebruiksvoorwaarden", href: "/terms" },
		{ label: "Merk", href: "/brand" },
	],
};

const CATEGORY_LABELS: Record<Category, string> = {
	resources: "Bronnen",
	company: "Bedrijf",
};

export function Footer() {
	return (
		<footer className="glass border-x-0 border-b-0">
			<div className="mx-auto max-w-5xl px-8 py-10">
				<div className="mb-8 grid grid-cols-1 gap-12 md:grid-cols-2">
					{/* Brand Section */}
					<div className="max-w-sm md:col-span-1">
						<div className="mb-4 flex items-center justify-start gap-2.5">
							<svg className="dgdh-lockup__mark" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
<rect width="1000" height="1000" fill="#4A1D20" />
<text x="509" y="434" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="500" fontSize="330" letterSpacing="18" fill="#FBF9F6">DG</text>
<text x="509" y="774" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight="500" fontSize="330" letterSpacing="18" fill="#FBF9F6">DH</text>
</svg>
							<span className="dgdh-lockup__name">CUT</span>
						</div>
						<p className="text-muted-foreground mb-5 text-sm md:text-left">
							De videobewerker in je browser voor korte video.
						</p>
					</div>

					<div className="flex items-start justify-start gap-12 py-2">
						{(Object.keys(links) as Category[]).map((category) => (
							<div key={category} className="flex flex-col gap-2">
								<h3 className="eyebrow">
									{CATEGORY_LABELS[category]}
								</h3>
								<ul className="space-y-2 text-sm">
									{links[category].map((link) => (
										<li key={link.href}>
											<Link
												href={link.href}
												className="text-muted-foreground hover:text-foreground transition-colors"
												target={
													link.href.startsWith("http") ? "_blank" : undefined
												}
												rel={
													link.href.startsWith("http")
														? "noopener noreferrer"
														: undefined
												}
											>
												{link.label}
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				{/* Bottom Section */}
				<div className="flex flex-col items-start justify-between gap-4 pt-2 md:flex-row">
					<div className="text-muted-foreground flex items-center gap-4 text-sm">
						<span>
							© {new Date().getFullYear()} DGDH CUT, Alle rechten voorbehouden
						</span>
					</div>
				</div>
			</div>
		</footer>
	);
}
