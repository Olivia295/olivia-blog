import { defaultLang, isLang, languages, type Lang } from "./config";
import { ui, type UIKey } from "./ui";

export function useTranslations(lang: Lang) {
	return function t(key: UIKey, vars?: Record<string, string | number>): string {
		let text: string = ui[lang][key] ?? ui[defaultLang][key] ?? key;
		if (vars) {
			for (const [name, value] of Object.entries(vars)) {
				text = text.replaceAll(`{${name}}`, String(value));
			}
		}
		return text;
	};
}

/** Build a locale-prefixed path, e.g. localePath('en', '/posts/') → '/en/posts/' */
export function localePath(lang: Lang, path = "/"): string {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	if (normalized === "/") return `/${lang}/`;
	return `/${lang}${normalized}`;
}

/** Strip /zh or /en prefix from a pathname */
export function stripLocalePrefix(pathname: string): string {
	const parts = pathname.split("/");
	// ["", "zh", "posts", ...]
	if (parts.length >= 2 && isLang(parts[1])) {
		const rest = parts.slice(2).join("/");
		return rest ? `/${rest}` : "/";
	}
	return pathname;
}

/** Swap locale in the current path, keeping the rest of the URL */
export function switchLocalePath(pathname: string, nextLang: Lang): string {
	const bare = stripLocalePrefix(pathname);
	return localePath(nextLang, bare);
}

export function getLangFromUrl(url: URL): Lang {
	const segment = url.pathname.split("/").filter(Boolean)[0];
	return isLang(segment) ? segment : defaultLang;
}

export function getStaticLangPaths() {
	return languages.map((lang) => ({ params: { lang } }));
}

export function withLangParams<T extends Record<string, string | undefined>>(
	extra: T[],
): { params: { lang: Lang } & T }[] {
	return languages.flatMap((lang) =>
		extra.map((params) => ({
			params: { lang, ...params },
		})),
	);
}
