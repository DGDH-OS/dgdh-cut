"use client";

import { cn } from "@/utils/ui";
import { WORKSPACE_PRESETS } from "./presets";
import { useWorkspaceStore } from "./workspace-store";

export function WorkspaceSwitcher() {
	const active = useWorkspaceStore((s) => s.active);
	const setActive = useWorkspaceStore((s) => s.setActive);

	return (
		<div
			role="tablist"
			aria-label="Workspaces"
			className="scrollbar-hidden flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-sm border p-0.5"
		>
			{WORKSPACE_PRESETS.map((preset) => {
				const selected = preset.id === active;
				return (
					<button
						key={preset.id}
						type="button"
						role="tab"
						aria-selected={selected}
						data-workspace={preset.id}
						title={preset.description}
						onClick={() => setActive(preset.id)}
						className={cn(
							"h-7 shrink-0 cursor-pointer rounded-sm px-2.5 text-xs font-medium focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
							selected
								? "bg-primary text-primary-foreground"
								: "text-foreground hover:bg-accent",
						)}
					>
						{preset.label}
					</button>
				);
			})}
		</div>
	);
}
