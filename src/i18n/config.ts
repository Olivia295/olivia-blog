export const languages = ["zh", "en"] as const;
export type Lang = (typeof languages)[number];

export const defaultLang: Lang = "zh";

export const languageLabels: Record<Lang, string> = {
	zh: "中文",
	en: "EN",
};

export const htmlLang: Record<Lang, string> = {
	zh: "zh-CN",
	en: "en-GB",
};

export const ogLocale: Record<Lang, string> = {
	zh: "zh_CN",
	en: "en_GB",
};

export const dateLocale: Record<Lang, string> = {
	zh: "zh-CN",
	en: "en-GB",
};

export const localeCookie = "locale";

export function isLang(value: string | undefined | null): value is Lang {
	return value === "zh" || value === "en";
}
