import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { type CollectionEntry, getCollection } from "astro:content";
import { isBarePreview } from "@/data/bare";

function loadSeriesOrder(): string[] {
	const file = path.join(process.cwd(), "src/content/site/series.json");
	if (!existsSync(file)) return [];
	try {
		const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
		if (Array.isArray(data)) return data.map((name) => String(name).trim()).filter(Boolean);
		if (data && typeof data === "object" && Array.isArray((data as { order?: unknown }).order)) {
			return (data as { order: unknown[] }).order.map((name) => String(name).trim()).filter(Boolean);
		}
	} catch {
		return [];
	}
	return [];
}

/** filter out draft posts based on the environment */
export async function getAllBlogs(): Promise<CollectionEntry<"blog">[]> {
	if (isBarePreview()) return [];
	return await getCollection("blog", ({ data }) => {
		return import.meta.env.PROD ? !data.draft : true;
	});
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

export function groupBlogsBySeries(
	blogs: CollectionEntry<"blog">[],
	uncategorized: string,
): Record<string, CollectionEntry<"blog">[]> {
	const grouped: Record<string, CollectionEntry<"blog">[]> = {};
	for (const blog of blogs) {
		const names = blogSeries(blog);
		if (!names.length) {
			(grouped[uncategorized] ??= []).push(blog);
			continue;
		}
		for (const key of names) {
			(grouped[key] ??= []).push(blog);
		}
	}
	return grouped;
}

/** Named series that actually exist on published blogs, sorted by site/series.json. */
export function getNamedSeries(blogs: CollectionEntry<"blog">[]): string[] {
	const names = new Set<string>();
	for (const blog of blogs) {
		for (const name of blogSeries(blog)) names.add(name);
	}
	const order = loadSeriesOrder();
	return [...names].sort((a, b) => {
		const ia = order.indexOf(a);
		const ib = order.indexOf(b);
		if (ia === -1 && ib === -1) return a.localeCompare(b, "zh");
		if (ia === -1) return 1;
		if (ib === -1) return -1;
		return ia - ib;
	});
}

export function getAllTags(blogs: CollectionEntry<"blog">[]) {
	return blogs.flatMap((blog) => [...blog.data.tags]);
}

export function getUniqueTags(blogs: CollectionEntry<"blog">[]) {
	return [...new Set(getAllTags(blogs))];
}

export function getUniqueTagsWithCount(blogs: CollectionEntry<"blog">[]): [string, number][] {
	return [
		...getAllTags(blogs).reduce(
			(acc, t) => acc.set(t, (acc.get(t) ?? 0) + 1),
			new Map<string, number>(),
		),
	].sort((a, b) => b[1] - a[1]);
}
