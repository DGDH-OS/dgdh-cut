import type { Metadata } from "next";
import { BasePage } from "@/app/base-page";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { SOCIAL_LINKS } from "@/site/social";

export const metadata: Metadata = {
	title: "Servicevoorwaarden - DGDH CUT",
	description:
		"DGDH CUT: eerlijke en transparante voorwaarden voor onze gratis en open-source videobewerker.",
	openGraph: {
		title: "Servicevoorwaarden - DGDH CUT",
		description:
			"DGDH CUT: eerlijke en transparante voorwaarden voor onze gratis en open-source videobewerker.",
		type: "website",
	},
};

export default function TermsPage() {
	return (
		<BasePage
			title="Servicevoorwaarden"
			description="Eerlijke en transparante voorwaarden voor onze gratis, open-source videobewerker. Neem contact op als je vragen hebt."
		>
			<Accordion type="single" collapsible className="w-full">
				<AccordionItem
					value="quick-summary"
					className="rounded-lg border px-5"
				>
					<AccordionTrigger className="no-underline!">
						Kort samengevat
					</AccordionTrigger>
					<AccordionContent>
						<h3 className="mb-3 text-lg font-medium">
							Jij bezit je content, wij bezitten niets.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								Alles draait lokaal in je browser: er wordt nooit iets naar onze servers geüpload
							</li>
							<li>
								We maken nooit aanspraak op eigendom van je content
							</li>
							<li>
								Gratis voor persoonlijk en commercieel gebruik, zonder watermerken of beperkingen
							</li>
							<li>
								Je bent zelf verantwoordelijk voor hoe je het gebruikt: overtreed de wet niet
							</li>
							<li>
								Dienst wordt geleverd &quot;as is&quot;: we kunnen geen perfecte beschikbaarheid garanderen
							</li>
							<li>
								Open source betekent dat je onze code kunt bekijken en zo nodig zelf kunt hosten
							</li>
							<li>
								Geen account nodig: je geëxporteerde video's blijven altijd van jou
							</li>
						</ol>
						<p className="mt-4">
							Vragen? Mail ons via{" "}
							<a
								href="mailto:oss@opencut.app"
								className="text-primary hover:underline"
							>
								oss@opencut.app
							</a>
						</p>
					</AccordionContent>
				</AccordionItem>
			</Accordion>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Jouw content, jouw rechten</h2>
				<p>
					<strong>Je bezit alles wat je maakt.</strong> Alle bewerking en verwerking gebeurt lokaal op je apparaat. We zien, bewaren of benaderen je bestanden nooit. We maken geen aanspraak op eigendom, licenties of rechten op je video's, projecten of andere content die je met DGDH CUT maakt.
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						Je content verlaat je apparaat nooit
					</li>
					<li>Je behoudt alle intellectuele eigendomsrechten op je content</li>
					<li>Je kunt je content exporteren en gebruiken zoals je wilt</li>
					<li>Geen watermerken, geen licentiebeperkingen van DGDH CUT</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Hoe je DGDH CUT kunt gebruiken</h2>
				<p>DGDH CUT is gratis voor persoonlijk en commercieel gebruik. Je mag:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						video's maken voor persoonlijke, educatieve of commerciële doelen
					</li>
					<li>DGDH CUT gebruiken voor klantwerk en betaalde projecten</li>
					<li>video's die met DGDH CUT zijn gemaakt delen en verspreiden</li>
					<li>
						de DGDH CUT-software aanpassen en verspreiden (onder MIT-licentie)
					</li>
				</ul>
				<p>
					Je bent zelf verantwoordelijk voor hoe je DGDH CUT gebruikt en voor de content die je maakt. Gebruik het niet voor iets wat in jouw rechtsgebied illegaal is.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">AI-functies</h2>
				<p>
					AI-functies zoals automatische ondertitels draaien volledig in je browser met modellen op je apparaat. Er wordt geen content naar een server geüpload. Deze functies zijn optioneel: je kunt DGDH CUT ook zonder gebruiken.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Dienst</h2>
				<p>
					DGDH CUT vereist op dit moment geen account. De dienst wordt geleverd &quot;as is&quot; zonder garanties. We streven naar betrouwbaarheid, maar kunnen een ononderbroken dienst niet garanderen.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Voordelen van open source</h2>
				<p>Omdat DGDH CUT open source is, heb je extra rechten:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Onze code bekijken om te zien hoe we met je gegevens omgaan</li>
					<li>DGDH CUT op je eigen servers hosten</li>
					<li>De software aanpassen aan je wensen</li>
					<li>Verbeteringen terugdelen met de community</li>
				</ul>
				<p>
					Bekijk onze broncode en licentie op{" "}
					<a
						href={SOCIAL_LINKS.github}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						GitHub
					</a>
					.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Beperkingen en aansprakelijkheid</h2>
				<p>
					DGDH CUT wordt gratis aangeboden. Voor zover de wet het toestaat:
				</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>zijn we niet aansprakelijk voor verlies van gegevens of content</li>
					<li>
						worden projecten in je browser opgeslagen en kunnen ze verloren gaan als je browsergegevens wist
					</li>
					<li>zijn we niet verantwoordelijk voor hoe je de dienst gebruikt</li>
					<li>is onze aansprakelijkheid beperkt tot het maximum dat de wet toestaat</li>
				</ul>
				<p>
					Omdat je content op je apparaat blijft, kunnen we verloren projecten niet herstellen. Exporteer belangrijke video's daarom zodra je klaar bent met bewerken.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Wijzigingen in de dienst</h2>
				<p>We kunnen DGDH CUT en deze voorwaarden bijwerken:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>We informeren je over belangrijke wijzigingen in deze voorwaarden</li>
					<li>Doorgaan met gebruiken betekent dat je updates accepteert</li>
					<li>Je kunt altijd een oudere versie zelf hosten als je dat wilt</li>
					<li>Grote wijzigingen bespreken we met de community op GitHub</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Stoppen met gebruik</h2>
				<p>Je kunt op elk moment stoppen met DGDH CUT:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Wis je browsergegevens om lokale projecten te verwijderen</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Contact</h2>
				<p>Vragen over deze voorwaarden of een probleem melden?</p>
				<p>
					Neem contact met ons op via onze{" "}
					<a
						href={`${SOCIAL_LINKS.github}/issues`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						GitHub-repository
					</a>
					, mail ons via{" "}
					<a
						href="mailto:oss@opencut.app"
						className="text-primary hover:underline"
					>
						oss@opencut.app
					</a>
					, of neem contact op via{" "}
					<a
						href={SOCIAL_LINKS.x}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						X (Twitter)
					</a>
					.
				</p>
				<p>
					Op deze voorwaarden is het toepasselijke recht in jouw rechtsgebied van toepassing. We lossen geschillen liever op via een vriendelijk gesprek in onze open-source community.
				</p>
			</section>
			<Separator />
			<p className="text-muted-foreground text-sm">
				Laatst bijgewerkt: 15 maart 2026
			</p>
		</BasePage>
	);
}
