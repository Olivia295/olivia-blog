import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AstroExpressiveCodeOptions } from "astro-expressive-code";
import type { SiteConfig } from "@/types";

/**
 * Public GitHub defaults — no personal identity.
 * Vercel/local overlay: gitignored `src/content/site/site.json`
 * from the private content repo (`site/site.json`).
 */
const defaults: SiteConfig & { shortName?: string } = {
	url: "https://example.com/",
	title: "Astro Cactus",
	author: "Guest",
	description: "A small static site.",
	lang: "zh-CN",
	ogLocale: "zh_CN",
	date: {
		locale: "zh-CN",
		options: {
			day: "numeric",
			month: "short",
			year: "numeric",
		},
	},
};

type SiteOverlay = Partial<Pick<SiteConfig, "url" | "title" | "author" | "description">> & {
	shortName?: string;
};

function loadSiteOverlay(): SiteOverlay {
	const file = path.join(process.cwd(), "src/content/site/site.json");
	if (!existsSync(file)) return {};
	try {
		return JSON.parse(readFileSync(file, "utf8")) as SiteOverlay;
	} catch {
		return {};
	}
}

const overlay = loadSiteOverlay();

export const siteConfig: SiteConfig = {
	url: overlay.url ?? defaults.url,
	title: overlay.title ?? defaults.title,
	author: overlay.author ?? defaults.author,
	description: overlay.description ?? defaults.description,
	lang: defaults.lang,
	ogLocale: defaults.ogLocale,
	date: defaults.date,
};

export const siteShortName = overlay.shortName ?? overlay.title ?? defaults.title;

/** Bare paths (no locale prefix). Titles come from i18n ui keys. */
export const menuLinkDefs: {
	path: string;
	titleKey: "nav.home" | "nav.blogs" | "nav.posts" | "nav.gallery" | "nav.about";
}[] = [
	{ path: "/", titleKey: "nav.home" },
	{ path: "/blogs/", titleKey: "nav.blogs" },
	{ path: "/posts/", titleKey: "nav.posts" },
	{ path: "/gallery/", titleKey: "nav.gallery" },
	{ path: "/about/", titleKey: "nav.about" },
];

// https://expressive-code.com/reference/configuration/
export const expressiveCodeOptions: AstroExpressiveCodeOptions = {
	styleOverrides: {
		borderRadius: "4px",
		codeFontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
		codeFontSize: "0.875rem",
		codeLineHeight: "1.7142857rem",
		codePaddingInline: "1rem",
		frames: {
			frameBoxShadowCssValue: "none",
		},
		uiLineHeight: "inherit",
	},
	themeCssSelector(theme, { styleVariants }) {
		if (styleVariants.length >= 2) {
			const baseTheme = styleVariants[0]?.theme;
			const altTheme = styleVariants.find((v) => v.theme.type !== baseTheme?.type)?.theme;
			if (theme === baseTheme || theme === altTheme) return `[data-theme='${theme.type}']`;
		}
		return `[data-theme="${theme.name}"]`;
	},
	themes: ["dracula", "github-light"],
	useThemedScrollbars: false,
};
