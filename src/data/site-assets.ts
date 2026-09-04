import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const bare = process.env.BARE === "1";

const LOGO_CANDIDATES = [
	"site/logo.png",
	"site/logo.jpg",
	"site/logo.jpeg",
	"site/logo.webp",
	"site/logo.svg",
	"logo.png",
];

const HERO_CANDIDATES = [
	"site/home-hero.jpg",
	"site/home-hero.jpeg",
	"site/home-hero.png",
	"site/home-hero.webp",
	"home-hero.jpg",
];

const ICON_CANDIDATES = [
	"site/icon.svg",
	"site/favicon.svg",
	"site/favicon.png",
	"site/favicon.ico",
	"site/icon.png",
	"site/logo.svg",
	"site/logo.png",
	"icon.svg",
];

function publicUrl(rel: string): string {
	return `/${rel.replace(/^\/+/, "")}`;
}

function firstPublic(candidates: string[], fallback: string): string {
	const list = bare ? candidates.filter((rel) => !rel.startsWith("site/")) : candidates;
	for (const rel of list) {
		if (existsSync(path.join(root, "public", rel))) return publicUrl(rel);
	}
	return fallback;
}

/** Header mark. Content `site/logo.*` wins; `public/logo.png` is the source default. */
export const siteLogoSrc = firstPublic(LOGO_CANDIDATES, "/logo.png");

/** Home hero. Content `site/home-hero.*` wins; `public/home-hero.jpg` is the source default. */
export const siteHeroSrc = firstPublic(HERO_CANDIDATES, "/home-hero.jpg");

/** Browser tab / favicon. Content `site/icon.*` or `site/favicon.*` wins. */
export const siteIconSrc = firstPublic(ICON_CANDIDATES, "/icon.svg");

export function siteIconMime(src = siteIconSrc): string {
	const ext = path.extname(src).toLowerCase();
	if (ext === ".svg") return "image/svg+xml";
	if (ext === ".png") return "image/png";
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".ico") return "image/x-icon";
	if (ext === ".webp") return "image/webp";
	return "image/png";
}

/** Filesystem path for astro-webmanifest (`public/...`). */
export function siteIconFile(src = siteIconSrc): string {
	return path.join("public", src.replace(/^\/+/, ""));
}

/** Display size after EXIF orientation, for `width`/`height` on `<img>`. */
export async function publicImageSize(
	src: string,
): Promise<{ width: number; height: number } | undefined> {
	const file = path.join(root, "public", src.replace(/^\/+/, ""));
	if (!existsSync(file)) return undefined;
	try {
		const meta = await sharp(file).metadata();
		if (!meta.width || !meta.height) return undefined;
		const swapped = (meta.orientation ?? 1) >= 5 && (meta.orientation ?? 1) <= 8;
		return {
			width: swapped ? meta.height : meta.width,
			height: swapped ? meta.width : meta.height,
		};
	} catch {
		return undefined;
	}
}
