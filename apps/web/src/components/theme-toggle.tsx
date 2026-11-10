"use client";

import { ThemeSwitch } from "@/app/theme/theme-switch";

/** Systeem / Licht / Donker (zie app/theme). Zelfde exportnaam als voorheen. */
export function ThemeToggle({ className }: { className?: string }) {
	return (
		<div className={className}>
			<ThemeSwitch />
		</div>
	);
}
