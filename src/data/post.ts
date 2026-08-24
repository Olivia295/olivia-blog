import { type CollectionEntry, getCollection } from "astro:content";
import { isBarePreview } from "@/data/bare";

/** Filter out draft notes based on the environment */
export async function getAllPosts(): Promise<CollectionEntry<"post">[]> {
	if (isBarePreview()) return [];
	return await getCollection("post", ({ data }) => {
		return import.meta.env.PROD ? !data.draft : true;
	});
}
