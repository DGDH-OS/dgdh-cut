"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "@/editor/use-editor";
import { type AgentPayload, importAgentProject } from "@/services/agent-import";
import { TICKS_PER_SECOND } from "@/wasm";

type AgentItem = {
	id: string;
	name: string;
	duration: number;
	createdAt: string;
	mediaCount: number;
};

/** `duration` uit de lijst is in MediaTime-ticks. */
function formatDuration(ticks: number): string {
	const seconds = ticks / TICKS_PER_SECOND;
	if (!Number.isFinite(seconds) || seconds <= 0) return "";
	const m = Math.floor(seconds / 60);
	const s = Math.round(seconds % 60);
	return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Projecten die agents headless hebben gebouwd (GET /api/agent/projects, Suite-sessie
 * of Bearer). Een agent-project heeft dezelfde id als het lokale project: al
 * geïmporteerd = "Openen", anders "Importeren" (idempotent, nooit een duplicaat).
 * Zonder toegang of zonder items blijft de sectie verborgen.
 */
export function AgentProjectsSection() {
	const editor = useEditor();
	const localIds = useEditor((e) => e.project.getSavedProjects().map((p) => p.id));
	const [items, setItems] = useState<AgentItem[]>([]);
	const [status, setStatus] = useState<Record<string, string>>({});

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/agent/projects", { cache: "no-store" });
				if (!res.ok) return;
				const data = (await res.json()) as { items?: AgentItem[] };
				if (!cancelled) setItems(data.items ?? []);
			} catch {
				// geen toegang of offline: sectie blijft verborgen
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const importOne = useCallback(
		async (id: string) => {
			setStatus((s) => ({ ...s, [id]: "Importeren…" }));
			try {
				const res = await fetch(`/api/agent/projects?id=${encodeURIComponent(id)}`, {
					cache: "no-store",
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				await importAgentProject({
					payload: (await res.json()) as AgentPayload,
					onProgress: (m) => setStatus((s) => ({ ...s, [id]: `Importeren: ${m}` })),
				});
				await editor.project.loadAllProjects();
				setStatus((s) => ({ ...s, [id]: "" }));
			} catch (e) {
				setStatus((s) => ({
					...s,
					[id]: `Mislukt: ${e instanceof Error ? e.message : "onbekende fout"}`,
				}));
			}
		},
		[editor.project],
	);

	if (items.length === 0) return null;

	return (
		<section className="px-4 flex flex-col gap-3" data-testid="agent-projects">
			<h2 className="text-sm font-medium">Agent-projecten</h2>
			<ul className="flex flex-col gap-2">
				{items.map((item) => {
					const local = localIds.includes(item.id);
					const duration = formatDuration(item.duration);
					return (
						<li
							key={item.id}
							className="flex items-center justify-between gap-3 rounded-lg border p-3"
							data-testid="agent-project"
						>
							<div className="min-w-0">
								<div className="truncate text-sm font-medium">{item.name}</div>
								<div className="text-muted-foreground text-xs">
									{item.mediaCount} media
									{duration && ` · ${duration}`}
									{local && " · staat al in je projecten"}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-3 text-xs">
								{status[item.id] && <span role="status">{status[item.id]}</span>}
								{local ? (
									<Button asChild size="sm" variant="outline">
										<Link href={`/editor/${item.id}`}>Openen</Link>
									</Button>
								) : (
									<Button
										size="sm"
										variant="outline"
										data-testid="agent-project-import"
										onClick={() => void importOne(item.id)}
									>
										Importeren in editor
									</Button>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
