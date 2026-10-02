import { type CollectionEntry, getCollection } from "astro:content";
import { isBarePreview } from "@/data/bare";
import type { PostTabId } from "@/data/post-tags";
import type { Lang } from "@/i18n/config";
import { localePath } from "@/i18n/utils";

/** Notes share one reading page; each entry keeps its own stable anchor. */
export function noteHref(lang: Lang, id: string) {
	return `${localePath(lang, "/posts/")}#post-${encodeURIComponent(id)}`;
}

export function postsHref(lang: Lang, filter: PostTabId = "all") {
	return `${localePath(lang, "/posts/")}${filter === "all" ? "" : `?type=${filter}`}`;
}

/** Filter out draft notes based on the environment */
export async function getAllPosts(): Promise<CollectionEntry<"post">[]> {
	if (isBarePreview()) return [];
	return await getCollection("post", ({ data }) => {
		return import.meta.env.PROD ? !data.draft : true;
	});
}
