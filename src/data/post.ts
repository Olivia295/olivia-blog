import { type CollectionEntry, getCollection } from "astro:content";
import { isBarePreview } from "@/data/bare";
import type { PostTabId } from "@/data/post-tags";
import type { Lang } from "@/i18n/config";
import { localePath } from "@/i18n/utils";

export const POST_PAGE_SIZE = 20;

export function postsHref(lang: Lang, filter: PostTabId, n: number) {
	if (filter === "all") {
		return n <= 1 ? localePath(lang, "/posts/") : localePath(lang, `/posts/${n}/`);
	}
	return n <= 1
		? localePath(lang, `/posts/${filter}/`)
		: localePath(lang, `/posts/${filter}/${n}/`);
}

/** Filter out draft notes based on the environment */
export async function getAllPosts(): Promise<CollectionEntry<"post">[]> {
	if (isBarePreview()) return [];
	return await getCollection("post", ({ data }) => {
		return import.meta.env.PROD ? !data.draft : true;
	});
}
