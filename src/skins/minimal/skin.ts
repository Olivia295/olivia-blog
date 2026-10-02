import type { Skin } from "../types.ts";
import copy from "./copy.ts";

export default {
	id: "minimal",
	label: { zh: "简洁版", en: "Minimal" },
	copy,
	palette: {
		light: {
			hull: "#faf8f5",
			surface: "#faf8f5",
			text: "#29262d",
			muted: "#68616f",
			accent: "oklch(0.5 0.18 312)",
		},
		dark: {
			hull: "#19181d",
			surface: "#19181d",
			text: "#e8e5ed",
			muted: "#aaa3b4",
			accent: "oklch(0.8 0.13 312)",
		},
	},
} satisfies Skin;
