import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Lang } from "@/i18n/config";

export type PageCopyId = "home" | "blogs" | "posts" | "gallery" | "about";

type CopyFile = Partial<Record<PageCopyId, Partial<Record<Lang, string>>>>;

function loadCopy(): CopyFile {
	const file = path.join(process.cwd(), "src/content/site/copy.json");
	if (!existsSync(file)) return {};
	try {
		return JSON.parse(readFileSync(file, "utf8")) as CopyFile;
	} catch {
		return {};
	}
}

const overlay = loadCopy();

/** Page lead under the title. Content `site/copy.json` wins; otherwise the i18n fallback. */
export function pageLead(page: PageCopyId, lang: Lang, fallback: string): string {
	const value = overlay[page]?.[lang]?.trim();
	return value || fallback;
}
