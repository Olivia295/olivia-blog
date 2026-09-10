export interface Skin {
	id: string;
	label: { zh: string; en: string };
	copy?: Record<string, { zh: string; en: string }>;
	palette: Record<
		"light" | "dark",
		{
			hull: string;
			surface: string;
			text: string;
			muted: string;
			accent: string;
		}
	>;
}
