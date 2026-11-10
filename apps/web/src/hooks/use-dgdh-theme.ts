"use client";

import { useEffect, useState } from "react";

type Pref = "system" | "light" | "dark";
type Api = { get(): Pref; onChange(fn: (p: Pref) => void): () => void };
const api = () => (window as unknown as { DgdhTheme?: Api }).DgdhTheme;

/** Vervangt next-themes: de voorkeur (Systeem/Licht/Donker) leeft in window.DgdhTheme (app/theme/dgdh-theme.js). */
export function useTheme(): { theme: Pref } {
	const [theme, setTheme] = useState<Pref>("system");
	useEffect(() => {
		const a = api();
		if (!a) return;
		setTheme(a.get());
		return a.onChange((p) => setTheme(p));
	}, []);
	return { theme };
}
