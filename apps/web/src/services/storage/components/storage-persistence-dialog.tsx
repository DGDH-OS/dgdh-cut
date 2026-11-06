"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useStoragePersistence } from "@/services/storage/use-storage-persistence";

export function StoragePersistenceDialog() {
	const { showDialog, onConfirm, onDismiss } = useStoragePersistence();

	return (
		<Dialog open={showDialog} onOpenChange={(open) => !open && onDismiss()}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Verlies je projecten niet</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<p className="text-base text-muted-foreground">
						Je browser kan je projecten automatisch verwijderen als de opslag
						bijna vol is.
					</p>
					<p className="text-base text-muted-foreground">
						DGDH CUT toestaan ze te beschermen?
					</p>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={onDismiss}>
						Niet nu
					</Button>
					<Button onClick={onConfirm}>Toestaan</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
