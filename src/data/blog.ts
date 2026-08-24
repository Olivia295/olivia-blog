import { type CollectionEntry, getCollection } from "astro:content";
import { isBarePreview } from "@/data/bare";

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

function seriesOf(blog: CollectionEntry<"blog">): string | undefined {
	return blog.data.series?.trim() || undefined;
}

export function groupBlogsBySeries(
	blogs: CollectionEntry<"blog">[],
	uncategorized: string,
): Record<string, CollectionEntry<"blog">[]> {
	const grouped: Record<string, CollectionEntry<"blog">[]> = {};
	for (const blog of blogs) {
		const key = seriesOf(blog) || uncategorized;
		(grouped[key] ??= []).push(blog);
	}
	return grouped;
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
