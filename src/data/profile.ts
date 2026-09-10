import { existsSync } from "node:fs";
import path from "node:path";
import { settings } from "@/data/settings";

/**
 * Public fake defaults (this file is on GitHub).
 * Real About copy: private content repo `site/about.json`
 * synced to gitignored `src/content/site/about.json`.
 * Portrait: content `site/about.jpg` → `public/site/about.jpg`.
 */
const PORTRAIT_CANDIDATES = [
	"site/about.jpg",
	"site/about.jpeg",
	"site/about.png",
	"site/about.webp",
];

function publicExists(rel: string): boolean {
	return existsSync(path.join(process.cwd(), "public", rel.replace(/^\/+/, "")));
}

function firstPortrait(preferred?: string): string {
	if (process.env.BARE === "1") return "/defaults/portrait.svg";
	if (preferred) {
		const name = preferred.replace(/^\/+/, "").replace(/^site\//, "");
		const rel = `site/${name}`;
		if (publicExists(rel)) return `/${rel}`;
	}
	for (const rel of PORTRAIT_CANDIDATES) {
		if (publicExists(rel)) return `/${rel.replace(/^\/+/, "")}`;
	}
	return "/defaults/portrait.svg";
}

export type { ProfileCopy, ProfileFact, ProfileLink } from "@/data/settings";
export const profile = {
	...settings.profile,
	portraitSrc: firstPortrait(settings.profile.portrait),
};
