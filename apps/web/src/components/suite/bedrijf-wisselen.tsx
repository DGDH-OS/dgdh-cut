"use client";

import { usePathname } from "next/navigation";

export type BedrijfOptie = { id: string; name: string };

/**
 * Bedrijfswisselaar (contract par. 2): gewone form-POST naar de Suite, de enige schrijver van de
 * cookie suite-organization. Werkt zonder JavaScript; `next` is de huidige pagina op deze host.
 */
export function BedrijfWisselen({ opties, actief, postUrl, origin }: {
	opties: BedrijfOptie[];
	actief: string;
	postUrl: string;
	origin: string;
}) {
	const pathname = usePathname();
	const next = `${origin.replace(/\/$/, "")}${pathname}`;
	return (
		<form method="post" action={postUrl} className="flex items-center gap-2">
			<label htmlFor="bedrijf-kiezen" className="text-muted-foreground">Bedrijf</label>
			<select
				id="bedrijf-kiezen"
				name="organization"
				defaultValue={actief}
				onChange={(e) => e.currentTarget.form?.requestSubmit()}
				className="bg-background text-foreground border-border h-8 rounded-md border px-2 text-sm"
			>
				{opties.map((o) => (
					<option key={o.id} value={o.id}>{o.name}</option>
				))}
			</select>
			<input type="hidden" name="next" value={next} />
			<noscript>
				<button type="submit" className="border-border h-8 rounded-md border px-3 text-sm">Wisselen</button>
			</noscript>
		</form>
	);
}
