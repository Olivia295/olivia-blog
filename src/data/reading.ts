import { type SeriesDefinition, seriesPath } from "./series.ts";

interface ReadingPost {
	id: string;
	data: { publishDate: Date; series: string[]; draft: boolean };
}

/** Each series keeps its own chronological reading order, including equal-date posts. */
export function seriesNeighbors<T extends ReadingPost>(
	current: T,
	posts: T[],
	catalog: SeriesDefinition[] = [],
) {
	if (current.data.draft) return [];
	const names = current.data.series.flatMap((name) =>
		seriesPath(catalog, name)
			.reverse()
			.map((entry) => entry.zh),
	);
	return [...new Set(names)].map((name) => {
		const sequence = posts
			.filter(
				(post) =>
					!post.data.draft &&
					post.data.series.some((child) =>
						seriesPath(catalog, child).some((entry) => entry.zh === name),
					),
			)
			.sort(
				(a, b) =>
					a.data.publishDate.getTime() - b.data.publishDate.getTime() ||
					(a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
			);
		const index = sequence.findIndex((post) => post.id === current.id);
		return {
			name,
			previous: index > 0 ? sequence[index - 1] : undefined,
			next: index >= 0 ? sequence[index + 1] : undefined,
		};
	});
}
