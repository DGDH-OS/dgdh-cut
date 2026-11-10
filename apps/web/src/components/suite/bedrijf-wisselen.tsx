"use client";

import { usePathname } from "next/navigation";

export type BedrijfOptie = { id: string; name: string };

/**
 * Bedrijfswisselaar (NAVFIX2): EEN mechanisme. Pills als <=5 bedrijven, anders een <select>.
 * Gewone form-POST naar de Suite (enige schrijver van de cookie suite-organization). Geen
 * apart 'Wissel'-knop en geen dubbel 'Bedrijf'-label.
 */
export function BedrijfWisselen({ opties, actief, postUrl, origin }: {
	opties: BedrijfOptie[];
	actief: string;
	postUrl: string;
	origin: string;
}) {
	const pathname = usePathname();
	const next = `${origin.replace(/\/$/, "")}${pathname}`;
	if (opties.length <= 5) {
		return (
			<form method="post" action={postUrl} className="flex flex-wrap items-center gap-2">
				<input type="hidden" name="next" value={next} />
				{opties.map((o) => (
					<button
						key={o.id}
						type="submit"
						name="organization"
						value={o.id}
						aria-pressed={o.id === actief}
						className={o.id === actief ? "org-pill org-pill--active" : "org-pill"}
					>
						{o.name}
					</button>
				))}
			</form>
		);
	}
	return (
		<form method="post" action={postUrl} className="flex items-center gap-2">
			<select
				name="organization"
				defaultValue={actief}
				aria-label="Bedrijf wisselen"
				onChange={(e) => e.currentTarget.form?.requestSubmit()}
				className="org-select"
			>
				{opties.map((o) => (
					<option key={o.id} value={o.id}>{o.name}</option>
				))}
			</select>
			<input type="hidden" name="next" value={next} />
		</form>
	);
}
