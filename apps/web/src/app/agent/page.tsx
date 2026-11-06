"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
	type AgentPayload,
	importAgentProject,
} from "@/services/agent-import";

type Item = {
	id: string;
	name: string;
	duration: number;
	createdAt: string;
	mediaCount: number;
};

export default function AgentInboxPage() {
	const [items, setItems] = useState<Item[]>([]);
	const [imported, setImported] = useState<Record<string, string>>({});
	const [status, setStatus] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/agent/projects", { cache: "no-store" });
			setItems(((await res.json()) as { items: Item[] }).items ?? []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Inbox laden mislukt");
		}
	}, []);

	const doImport = useCallback(async (id: string) => {
		setStatus((s) => ({ ...s, [id]: "importeren…" }));
		try {
			const res = await fetch(`/api/agent/projects?id=${id}`, {
				cache: "no-store",
			});
			if (!res.ok) throw new Error(`inbox HTTP ${res.status}`);
			const payload = (await res.json()) as AgentPayload;
			await importAgentProject({
				payload,
				onProgress: (m) => setStatus((s) => ({ ...s, [id]: `importeren ${m}` })),
			});
			setImported((s) => ({ ...s, [id]: id }));
			setStatus((s) => ({ ...s, [id]: "geïmporteerd" }));
		} catch (e) {
			setStatus((s) => ({
				...s,
				[id]: `mislukt: ${e instanceof Error ? e.message : e}`,
			}));
		}
	}, []);

	useEffect(() => {
		void load();
		const auto = new URLSearchParams(window.location.search).get("id");
		if (auto) void doImport(auto);
	}, [load, doImport]);

	return (
		<main className="mx-auto max-w-2xl space-y-4 p-8">
			<h1 className="text-2xl font-semibold">Agent-inbox</h1>
			<p className="text-muted-foreground text-sm">
				Projecten die headless door agents zijn gebouwd (scripts/agent/build-reel.ts).
			</p>
			{error && <p className="text-destructive text-sm">{error}</p>}
			<ul className="space-y-2" data-testid="agent-inbox">
				{items.length === 0 && <li className="text-sm">Inbox is leeg.</li>}
				{items.map((it) => (
					<li
						key={it.id}
						className="flex items-center justify-between rounded border p-3"
						data-testid="agent-item"
					>
						<div>
							<div className="font-medium">{it.name}</div>
							<div className="text-muted-foreground text-xs">
								{it.mediaCount} media · {it.id}
							</div>
						</div>
						<div className="flex items-center gap-3 text-sm">
							<span data-testid="agent-status">{status[it.id] ?? ""}</span>
							{imported[it.id] ? (
								<Link
									href={`/editor/${it.id}`}
									className="rounded bg-primary px-3 py-1 text-primary-foreground"
									data-testid="agent-open"
								>
									Openen in editor
								</Link>
							) : (
								<button
									type="button"
									className="rounded border px-3 py-1"
									onClick={() => void doImport(it.id)}
									data-testid="agent-import"
								>
									Importeren
								</button>
							)}
						</div>
					</li>
				))}
			</ul>
		</main>
	);
}
