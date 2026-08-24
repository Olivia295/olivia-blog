import type { APIRoute } from "astro";
import rss from "@astrojs/rss";
import { getAllPosts } from "@/data/post";
import { isLang } from "@/i18n/config";
import { languages } from "@/i18n/config";
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
	const posts = await getAllPosts();

	return rss({
		title: siteConfig.title,
		description: t("site.description"),
		site: import.meta.env.SITE,
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.publishDate,
			link: `${lang}/posts/${post.id}/`,
		})),
	});
};
