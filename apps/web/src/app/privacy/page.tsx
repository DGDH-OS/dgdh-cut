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
	title: "Privacybeleid - DGDH CUT",
	description:
		"Leer hoe DGDH CUT omgaat met je gegevens en privacy. Onze belofte: we beschermen je informatie terwijl je video's bewerkt.",
	openGraph: {
		title: "Privacybeleid - DGDH CUT",
		description:
			"Leer hoe DGDH CUT omgaat met je gegevens en privacy. Onze belofte: we beschermen je informatie terwijl je video's bewerkt.",
		type: "website",
	},
};

export default function PrivacyPage() {
	return (
		<BasePage
			title="Privacybeleid"
			description="Lees hoe we met je gegevens en privacy omgaan. Neem contact op als je vragen hebt."
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
							Je content verlaat je apparaat nooit.
						</h3>
						<ol className="list-decimal space-y-2 pl-6">
							<li>
								Bewerken gebeurt lokaal in je browser: wij zien je bestanden nooit
							</li>
							<li>
								AI-functies zoals automatische ondertitels draaien ook lokaal in je browser: er wordt niets geüpload
							</li>
							<li>
								DGDH CUT vereist op dit moment geen account of login
							</li>
							<li>Projectgegevens blijven op je apparaat, niet op onze servers</li>
							<li>
								We gebruiken geanonimiseerde analytics om de app te verbeteren, maar er wordt geen persoonlijke video-inhoud gevolgd
							</li>
							<li>Je kunt lokale gegevens op elk moment uit je browser wissen</li>
							<li>
								We verkopen of delen je gegevens met niemand (we hebben ze niet eens)
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
				<h2 className="text-2xl font-semibold">Hoe we met je content omgaan</h2>
				<p>
					<strong>
						Alle bewerking en verwerking gebeurt lokaal op je apparaat.
					</strong>{" "}
					We uploaden, bewaren of benaderen je video- of audiobestanden nooit. Je content blijft volledig privé en onder jouw controle. AI-functies zoals automatische ondertitels draaien ook in je browser met modellen op je apparaat: geen enkele content verlaat je apparaat.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Accounts en inloggen</h2>
				<p>
					DGDH CUT biedt op dit moment geen gebruikersaccounts, login of inloggen met Google.
				</p>
				<p>
					Omdat er nu geen accountsysteem is, verzamelen we geen account-e-mailadressen, profielgegevens of OAuth-identiteitsgegevens.
				</p>
				<p>
					Je projecten worden nooit op onze servers opgeslagen. Alle projectgegevens, inclusief namen, miniaturen en aanmaakdatums, worden lokaal in je browser opgeslagen met IndexedDB.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Analytics</h2>
				<p>
					We gebruiken{" "}
					<a
						href="https://www.databuddy.cc"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary hover:underline"
					>
						Databuddy
					</a>{" "}
					voor eenvoudige, geanonimiseerde bezoekersaantallen. We volgen geen klikken, interacties of hoe je de editor gebruikt.
				</p>
				<p>
					Er worden geen persoonsgegevens verzameld, individuele gebruikers worden niet gevolgd en er worden geen gegevens opgeslagen waarmee je geïdentificeerd kunt worden.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Lokale opslag en cookies</h2>
				<p>We gebruiken lokale opslag van de browser en IndexedDB om:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>je projecten lokaal op je apparaat op te slaan</li>
					<li>je editorvoorkeuren en instellingen te onthouden</li>
					<li>appstatus op te slaan die de editor tussen sessies nodig heeft</li>
				</ul>
				<p>
					Alle gegevens blijven op je apparaat en kun je op elk moment wissen via je browserinstellingen.
				</p>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Diensten van derden</h2>
				<p>DGDH CUT werkt samen met deze diensten:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>
						<strong>Vercel:</strong> Voor hosting en contentlevering
					</li>
					<li>
						<strong>Databuddy:</strong> Voor geanonimiseerde analytics
					</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Jouw rechten</h2>
				<p>Je hebt volledige controle over je gegevens:</p>
				<ul className="list-disc space-y-2 pl-6">
					<li>Je hebt nu geen account nodig om DGDH CUT te gebruiken</li>
					<li>Wis de lokale opslag om alle opgeslagen projecten te verwijderen</li>
					<li>Neem contact met ons op bij privacyvragen</li>
				</ul>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-2xl font-semibold">Open-source transparantie</h2>
				<p>
					DGDH CUT is volledig open source. Je kunt onze code bekijken, precies zien hoe we met gegevens omgaan en de applicatie desgewenst zelf hosten.
				</p>
				<p>
					Bekijk onze broncode op{" "}
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
				<h2 className="text-2xl font-semibold">Contact</h2>
				<p>Vragen over dit privacybeleid of hoe we met je gegevens omgaan?</p>
				<p>
					Open een issue in onze{" "}
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
			</section>

			<Separator />

			<p className="text-muted-foreground text-sm">
				Laatst bijgewerkt: 15 maart 2026
			</p>
		</BasePage>
	);
}
