import type { APIRoute } from "astro";
import rss from "@astrojs/rss";
import { getAllNotes } from "@/data/note";
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
	const notes = await getAllNotes();

	return rss({
		title: siteConfig.title,
		description: t("site.description"),
		site: import.meta.env.SITE,
		items: notes.map((note) => ({
			title: note.data.title,
			pubDate: note.data.publishDate,
			// Notes are inline on the feed page (no detail route).
			link: `${lang}/notes/#note-${note.id}`,
		})),
	});
};
