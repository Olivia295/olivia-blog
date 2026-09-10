import copy from "./copy.ts";
import type { Skin } from "../types.ts";

export default {
	id: "spaceship",
	label: { zh: "飞船版", en: "Spaceship" },
	copy,
	palette: {
		light: {
			hull: "#cbd0d3",
			surface: "#f4f6f7",
			text: "#252b31",
			muted: "#53616c",
			accent: "#825024",
		},
		dark: {
			hull: "#181e25",
			surface: "#242c34",
			text: "#edf1f4",
			muted: "#b5c1cb",
			accent: "#eabb84",
		},
	},
} satisfies Skin;
