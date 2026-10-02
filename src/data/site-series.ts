import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
	expandSeries as catalogExpand,
	seriesPath as catalogPath,
	parseSeriesCatalog,
	resolveSeries,
} from "@/data/series";
import type { Lang } from "@/i18n/config";

const file = path.join(process.cwd(), "src/content/site/series.json");
export const seriesCatalog = existsSync(file)
	? parseSeriesCatalog(JSON.parse(readFileSync(file, "utf8")))
	: [];
export const seriesInfo = (name: string) => resolveSeries(seriesCatalog, name);
export const seriesPath = (name: string) => catalogPath(seriesCatalog, name);
export const expandSeries = (names: string[]) => catalogExpand(seriesCatalog, names);
export const seriesContains = (parent: string, child: string) =>
	seriesPath(child).some((entry) => entry.id === seriesInfo(parent).id);
export const seriesLabel = (name: string, lang: Lang) => seriesInfo(name)[lang];
export const seriesHref = (name: string, lang: Lang) =>
	`/${lang}/blogs/?series=${encodeURIComponent(seriesInfo(name).id)}`;
export const legacySeriesLinks = () =>
	seriesCatalog.flatMap((entry) =>
		entry.legacyTags.map((tag) => ({ tag: tag.toLowerCase(), id: entry.id })),
	);
