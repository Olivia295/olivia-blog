export interface SeriesDefinition {
	id: string;
	zh: string;
	en: string;
	aliases: string[];
	legacyTags: string[];
	parent?: string;
	description?: { zh?: string; en?: string };
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
	const catalog = rows.map((row: unknown, index) => {
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
		const result: SeriesDefinition = {
			id: (data.id as string).trim(),
			zh: (data.zh as string).trim(),
			en: (data.en as string).trim(),
			aliases: list("aliases"),
			legacyTags: list("legacyTags"),
		};
		if (data.parent !== undefined) {
			if (typeof data.parent !== "string" || !data.parent.trim())
				throw new Error(`Series ${index + 1}: invalid parent`);
			result.parent = data.parent.trim();
		}
		if (data.description !== undefined) {
			const description = data.description;
			if (!description || typeof description !== "object" || Array.isArray(description))
				throw new Error(`Series ${index + 1}: invalid description`);
			result.description = {};
			for (const lang of ["zh", "en"] as const) {
				const text = (description as Record<string, unknown>)[lang];
				if (text !== undefined && typeof text !== "string")
					throw new Error(`Series ${index + 1}: invalid description.${lang}`);
				if (typeof text === "string" && text.trim()) result.description[lang] = text.trim();
			}
		}
		if (result.id === "all" || /[/?#]/.test(result.id)) throw new Error("Invalid series id");
		for (const name of [result.id, result.zh, result.en, ...result.aliases, ...result.legacyTags]) {
			const key = name.toLowerCase();
			if (owners.has(key) && owners.get(key) !== index)
				throw new Error(`Ambiguous series name: ${name}`);
			owners.set(key, index);
		}
		return result;
	});
	for (const entry of catalog) {
		if (entry.parent && !catalog.some((parent) => parent.id === entry.parent))
			throw new Error(`Unknown parent ${entry.parent} for series ${entry.id}`);
		seriesPath(catalog, entry.id);
	}
	// Keep siblings in author-defined order, with each parent before its descendants.
	const ordered: SeriesDefinition[] = [];
	const visit = (parent?: string) => {
		for (const entry of catalog.filter((row) => row.parent === parent)) {
			ordered.push(entry);
			visit(entry.id);
		}
	};
	visit();
	return ordered;
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

/** Resolve a writing category to its complete root-to-leaf path. */
export function seriesPath(catalog: SeriesDefinition[], name: string): SeriesDefinition[] {
	const path: SeriesDefinition[] = [];
	let entry: SeriesDefinition | undefined = resolveSeries(catalog, name);
	while (entry) {
		if (path.some((item) => item.id === entry!.id))
			throw new Error(`Circular series parent: ${entry.id}`);
		path.unshift(entry);
		entry = entry.parent ? catalog.find((item) => item.id === entry!.parent) : undefined;
	}
	return path;
}

export function expandSeries(catalog: SeriesDefinition[], names: string[]): SeriesDefinition[] {
	return [
		...new Map(
			names.flatMap((name) => seriesPath(catalog, name)).map((entry) => [entry.id, entry]),
		).values(),
	];
}

/** An author only needs the most specific category; parents are inferred. */
export function normalizeSeries(catalog: SeriesDefinition[], names: string[]): string[] {
	const paths = names.map((name) => seriesPath(catalog, name));
	return [
		...new Set(
			paths
				.map((path) => path.at(-1)!)
				.filter(
					(entry) =>
						!paths.some((path) => path.slice(0, -1).some((ancestor) => ancestor.id === entry.id)),
				)
				.map((entry) => entry.zh),
		),
	];
}
