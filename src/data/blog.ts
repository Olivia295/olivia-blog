import { type CollectionEntry, getCollection } from "astro:content";
import { isBarePreview } from "@/data/bare";
import { normalizeSeries } from "@/data/series";
import { expandSeries, seriesCatalog, seriesContains } from "@/data/site-series";

/** filter out draft posts based on the environment */
export async function getAllBlogs(): Promise<CollectionEntry<"blog">[]> {
	if (isBarePreview()) return [];
	const blogs = await getCollection("blog", ({ data }) => {
		return import.meta.env.PROD ? !data.draft : true;
	});
	return blogs.map((blog) => ({
		...blog,
		data: {
			...blog.data,
			series: normalizeSeries(seriesCatalog, blog.data.series),
		},
	}));
}

/** Get tag metadata by tag name */
export async function getTagMeta(tag: string): Promise<CollectionEntry<"tag"> | undefined> {
	const tagEntries = await getCollection("tag", (entry) => {
		return entry.id === tag;
	});
	return tagEntries[0];
}

/** groups posts by year (based on option siteConfig.sortPostsByUpdatedDate), using the year as the key
 *  Note: This function doesn't filter draft posts, pass it the result of getAllPosts above to do so.
 */
export function groupBlogsByYear(blogs: CollectionEntry<"blog">[]) {
	return Object.groupBy(blogs, (blog) => blog.data.publishDate.getFullYear().toString());
}

export function blogSeries(blog: CollectionEntry<"blog">): string[] {
	return blog.data.series ?? [];
}

export function blogInSeries(blog: CollectionEntry<"blog">, name: string): boolean {
	return blogSeries(blog).some((child) => seriesContains(name, child));
}

export function groupBlogsBySeries(
	blogs: CollectionEntry<"blog">[],
	uncategorized: string,
): Record<string, CollectionEntry<"blog">[]> {
	const grouped: Record<string, CollectionEntry<"blog">[]> = {};
	for (const blog of blogs) {
		const names = expandSeries(blogSeries(blog)).map((entry) => entry.zh);
		if (!names.length) {
			grouped[uncategorized] ??= [];
			grouped[uncategorized].push(blog);
			continue;
		}
		for (const key of names) {
			grouped[key] ??= [];
			grouped[key].push(blog);
		}
	}
	return grouped;
}

/** Configured series stay discoverable even while their first article is being written. */
export function getNamedSeries(blogs: CollectionEntry<"blog">[], includeEmpty = true): string[] {
	const names = new Set<string>(includeEmpty ? seriesCatalog.map((entry) => entry.zh) : []);
	for (const blog of blogs) {
		for (const entry of expandSeries(blogSeries(blog))) names.add(entry.zh);
	}
	const order = seriesCatalog.map((entry) => entry.zh);
	return [...names].sort((a, b) => {
		const ia = order.indexOf(a);
		const ib = order.indexOf(b);
		if (ia === -1 && ib === -1) return a.localeCompare(b, "zh");
		if (ia === -1) return 1;
		if (ib === -1) return -1;
		return ia - ib;
	});
}

export function getSeriesWithCount(blogs: CollectionEntry<"blog">[]): [string, number][] {
	return getNamedSeries(blogs).map((name) => [
		name,
		blogs.filter((blog) => blogInSeries(blog, name)).length,
	]);
}
