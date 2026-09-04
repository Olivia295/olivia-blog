import type { APIRoute } from "astro";
import rss from "@astrojs/rss";
import { resolvePostTags } from "@/data/post-tags";
import { getAllPosts } from "@/data/post";
import { isLang, languages } from "@/i18n/config";
import { useTranslations } from "@/i18n/utils";
import { siteConfig } from "@/site.config";

export function getStaticPaths() {
	return languages.map((lang) => ({ params: { lang } }));
}

export const GET: APIRoute = async ({ params }) => {
	const lang = params.lang;
	if (!isLang(lang)) {
		return new Response("Not found", { status: 404 });
	}
	const t = useTranslations(lang);
	const notes = await getAllPosts();

	return rss({
		title: siteConfig.title,
		description: t("site.description"),
		site: import.meta.env.SITE,
		items: notes.map((note) => ({
			title:
				note.data.title ||
				resolvePostTags(note.data.tags, lang)
					.map((tag) => tag.label)
					.join(" · ") ||
				note.data.publishDate.toISOString().slice(0, 10),
			pubDate: note.data.publishDate,
			link: `${lang}/posts/#post-${note.id}`,
		})),
	});
};
