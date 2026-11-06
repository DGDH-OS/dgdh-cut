import type { ParamDefinition } from "@/params";

export type GraphicStrokeAlign = "inside" | "center" | "outside";

export const STROKE_ALIGN_PARAM: ParamDefinition<"strokeAlign"> = {
	key: "strokeAlign",
	label: "Omlijning uitlijnen",
	type: "select",
	default: "center",
	group: "stroke",
	options: [
		{ value: "inside", label: "Binnen" },
		{ value: "center", label: "Midden" },
		{ value: "outside", label: "Buiten" },
	],
};
