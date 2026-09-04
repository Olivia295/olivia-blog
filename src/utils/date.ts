import { dateLocale, defaultLang, type Lang } from "@/i18n/config";
import { siteConfig } from "@/site.config";

export function getFormattedDate(
	date: Date | undefined,
	options?: Intl.DateTimeFormatOptions,
	lang: Lang = defaultLang,
): string {
	if (date === undefined) {
		return "Invalid Date";
	}

	const merged: Intl.DateTimeFormatOptions = {
		...(siteConfig.date.options as Intl.DateTimeFormatOptions),
		...options,
	};

	if (merged.year === undefined) {
		delete merged.year;
	}

	return new Intl.DateTimeFormat(dateLocale[lang] ?? siteConfig.date.locale, merged).format(date);
}

export function collectionDateSort<T extends { data: { publishDate: Date } }>(a: T, b: T) {
	return b.data.publishDate.getTime() - a.data.publishDate.getTime();
}
