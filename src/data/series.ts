export interface SeriesDefinition {
	id: string;
	zh: string;
	en: string;
	aliases: string[];
	legacyTags: string[];
}

/** One catalog owns names, translations and durable link identities. */
export function parseSeriesCatalog(value: unknown): SeriesDefinition[] {
	const rows = Array.isArray(value)
		? value
		: value && typeof value === "object" && "order" in value
			? value.order
			: undefined;
	if (!Array.isArray(rows)) throw new Error("site/series.json must contain an array of series");
	const owners = new Map<string, number>();
	return rows.map((row: unknown, index) => {
		const entry = typeof row === "string" ? { id: row, zh: row, en: row } : row;
		if (!entry || typeof entry !== "object") throw new Error("Invalid series definition");
		const data = entry as Record<string, unknown>;
		for (const key of ["id", "zh", "en"])
			if (typeof data[key] !== "string" || !data[key].trim())
				throw new Error(`Series ${index + 1} needs ${key}`);
		const list = (key: string): string[] => {
			if (data[key] === undefined) return [];
			if (!Array.isArray(data[key]) || data[key].some((v) => typeof v !== "string" || !v.trim()))
				throw new Error(`Series ${index + 1}: invalid ${key}`);
			return data[key].map((v: string) => v.trim());
		};
		const result = {
			id: (data.id as string).trim(),
			zh: (data.zh as string).trim(),
			en: (data.en as string).trim(),
			aliases: list("aliases"),
			legacyTags: list("legacyTags"),
		};
		if (result.id === "all" || /[/?#]/.test(result.id)) throw new Error("Invalid series id");
		for (const name of [result.id, result.zh, result.en, ...result.aliases, ...result.legacyTags]) {
			const key = name.toLowerCase();
			if (owners.has(key) && owners.get(key) !== index)
				throw new Error(`Ambiguous series name: ${name}`);
			owners.set(key, index);
		}
		return result;
	});
}

export function resolveSeries(catalog: SeriesDefinition[], name: string): SeriesDefinition {
	const value = name.trim();
	return (
		catalog.find((entry) =>
			[entry.id, entry.zh, entry.en, ...entry.aliases, ...entry.legacyTags].some(
				(alias) => alias.toLowerCase() === value.toLowerCase(),
			),
		) ?? { id: value, zh: value, en: value, aliases: [], legacyTags: [] }
	);
}
