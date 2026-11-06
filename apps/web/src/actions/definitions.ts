import type { ShortcutKey } from "@/actions/keybinding";
import type { TActionWithOptionalArgs } from "./types";

export type TActionCategory =
	| "playback"
	| "navigation"
	| "editing"
	| "selection"
	| "history"
	| "timeline"
	| "controls"
	| "assets";

export interface TActionBaseDefinition {
	description: string;
	category: TActionCategory;
	args?: Record<string, unknown>;
}

export interface TActionDefinition extends TActionBaseDefinition {
	defaultShortcuts?: readonly ShortcutKey[];
}

export const ACTIONS = {
	"toggle-play": {
		description: "Afspelen/pauzeren",
		category: "playback",
	},
	"stop-playback": {
		description: "Afspelen stoppen",
		category: "playback",
	},
	"seek-forward": {
		description: "1 seconde vooruit",
		category: "playback",
		args: { seconds: "number" },
	},
	"seek-backward": {
		description: "1 seconde terug",
		category: "playback",
		args: { seconds: "number" },
	},
	"frame-step-forward": {
		description: "Eén frame vooruit",
		category: "navigation",
	},
	"frame-step-backward": {
		description: "Eén frame terug",
		category: "navigation",
	},
	"jump-forward": {
		description: "5 seconden vooruit springen",
		category: "navigation",
		args: { seconds: "number" },
	},
	"jump-backward": {
		description: "5 seconden terug springen",
		category: "navigation",
		args: { seconds: "number" },
	},
	"goto-start": {
		description: "Naar begin van de tijdlijn",
		category: "navigation",
	},
	"goto-end": {
		description: "Naar einde van de tijdlijn",
		category: "navigation",
	},
	split: {
		description: "Elementen splitsen bij de afspeelkop",
		category: "editing",
	},
	"split-left": {
		description: "Splitsen en links verwijderen",
		category: "editing",
	},
	"split-right": {
		description: "Splitsen en rechts verwijderen",
		category: "editing",
	},
	"delete-selected": {
		description: "Selectie verwijderen",
		category: "editing",
	},
	"copy-selected": {
		description: "Geselecteerde elementen kopiëren",
		category: "editing",
	},
	"paste-copied": {
		description: "Elementen plakken bij de afspeelkop",
		category: "editing",
	},
	"toggle-snapping": {
		description: "Uitlijnen aan/uit",
		category: "editing",
	},
	"toggle-ripple-editing": {
		description: "Ripple-bewerking aan/uit",
		category: "editing",
	},
	"toggle-source-audio": {
		description: "Bronaudio extraheren of herstellen",
		category: "editing",
	},
	"select-all": {
		description: "Alle elementen selecteren",
		category: "selection",
	},
	"cancel-interaction": {
		description: "Huidige actie annuleren",
		category: "controls",
	},
	"deselect-all": {
		description: "Selectie van alle elementen opheffen",
		category: "selection",
	},
	"duplicate-selected": {
		description: "Geselecteerd element dupliceren",
		category: "selection",
	},
	"toggle-elements-muted-selected": {
		description: "Geselecteerde elementen dempen/dempen opheffen",
		category: "selection",
	},
	"toggle-elements-visibility-selected": {
		description: "Geselecteerde elementen tonen/verbergen",
		category: "selection",
	},
	"toggle-bookmark": {
		description: "Bladwijzer bij afspeelkop aan/uit",
		category: "timeline",
	},
	undo: {
		description: "Ongedaan maken",
		category: "history",
	},
	redo: {
		description: "Opnieuw",
		category: "history",
	},
	"remove-media-asset": {
		description: "Mediabestand verwijderen",
		category: "assets",
		args: { projectId: "string", assetId: "string" },
	},
	"remove-media-assets": {
		description: "Mediabestanden verwijderen",
		category: "assets",
		args: { projectId: "string", assetIds: "string[]" },
	},
} as const satisfies Record<string, TActionBaseDefinition>;

export type TAction = keyof typeof ACTIONS;

const ACTIONS_WITH_REQUIRED_ARGS = new Set<string>([
	"remove-media-asset",
	"remove-media-assets",
]);

export function isActionWithOptionalArgs(
	value: string,
): value is TActionWithOptionalArgs {
	return (
		Object.hasOwn(ACTIONS, value) &&
		!ACTIONS_WITH_REQUIRED_ARGS.has(value)
	);
}

const ACTION_DEFAULT_SHORTCUTS = [
	["toggle-play", ["space", "k"]],
	["seek-forward", ["l"]],
	["seek-backward", ["j"]],
	["frame-step-forward", ["right"]],
	["frame-step-backward", ["left"]],
	["jump-forward", ["shift+right"]],
	["jump-backward", ["shift+left"]],
	["goto-start", ["home", "enter"]],
	["goto-end", ["end"]],
	["split", ["s"]],
	["split-left", ["q"]],
	["split-right", ["w"]],
	["delete-selected", ["backspace", "delete"]],
	["copy-selected", ["ctrl+c"]],
	["paste-copied", ["ctrl+v"]],
	["toggle-snapping", ["n"]],
	["select-all", ["ctrl+a"]],
	["cancel-interaction", ["escape"]],
	["duplicate-selected", ["ctrl+d"]],
	["undo", ["ctrl+z"]],
	["redo", ["ctrl+shift+z", "ctrl+y"]],
] as const satisfies ReadonlyArray<
	readonly [TActionWithOptionalArgs, readonly ShortcutKey[]]
>;

const ACTION_DEFAULT_SHORTCUTS_BY_ACTION = new Map<
	TAction,
	readonly ShortcutKey[]
>(ACTION_DEFAULT_SHORTCUTS);

export function getActionDefinition({
	action,
}: {
	action: TAction;
}): TActionDefinition {
	return {
		...ACTIONS[action],
		defaultShortcuts: ACTION_DEFAULT_SHORTCUTS_BY_ACTION.get(action),
	};
}

export function getDefaultShortcuts(): Map<
	ShortcutKey,
	TActionWithOptionalArgs
> {
	const shortcuts = new Map<ShortcutKey, TActionWithOptionalArgs>();

	for (const [action, defaultShortcuts] of ACTION_DEFAULT_SHORTCUTS) {
		for (const shortcut of defaultShortcuts) {
			shortcuts.set(shortcut, action);
		}
	}

	return shortcuts;
}
