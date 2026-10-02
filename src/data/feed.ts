import type { CollectionEntry } from "astro:content";
import rss from "@astrojs/rss";
import { getAllBlogs } from "@/data/blog";
import { contentMediaBase, renderEntryHtml } from "@/data/content-render";
import {
	escapeXml,
	type FeedKind,
	feedContent,
	feedGuid,
	feedLabel,
	feedPath,
	feedSummary,
	postFeedMetadata,
	publishedFeedEntries,
} from "@/data/feed-content";
import { getAllPosts, noteHref } from "@/data/post";
import { recommendationMediaUrl } from "@/data/recommendation";
import type { Lang } from "@/i18n/config";
import { siteConfig } from "@/site.config";

export async function feedResponse(kind: FeedKind, lang: Lang): Promise<Response> {
	const entries: (CollectionEntry<"blog"> | CollectionEntry<"post">)[] = [
		...(kind === "posts" ? [] : await getAllBlogs()),
		...(kind === "blogs" ? [] : await getAllPosts()),
	];
	const items = [];
	for (const entry of publishedFeedEntries(entries)) {
		const link = new URL(
			entry.collection === "blog" ? `/${lang}/blogs/${entry.id}/` : noteHref(lang, entry.id),
			siteConfig.url,
		).href;
		const html = await renderEntryHtml(entry, link, siteConfig.url);
		const recommendation = entry.collection === "post" ? entry.data.recommendation : undefined;
		const content = await feedContent(html, {
			pageUrl: link,
			mediaUrl: contentMediaBase(entry, siteConfig.url),
			lang,
			recommendation: recommendation
				? {
						...recommendation,
						cover: recommendation.cover
							? recommendationMediaUrl(recommendation.cover, entry.id, entry.filePath)
							: undefined,
						audio: recommendation.audio
							? recommendationMediaUrl(recommendation.audio, entry.id, entry.filePath)
							: undefined,
					}
				: undefined,
		});
		const metadata =
			entry.collection === "blog"
				? {
						title: entry.data.title,
						description: feedSummary(entry.data.description, content.text),
					}
				: postFeedMetadata(content.text, entry.data.publishDate, lang, recommendation?.title);
		items.push({
			...metadata,
			pubDate: entry.data.publishDate,
			link,
			content: content.html,
			customData: `<guid isPermaLink="false">${escapeXml(feedGuid(entry.collection, entry.id, lang, siteConfig.url))}</guid>`,
		});
	}
	return rss({
		title: `${siteConfig.title} · ${feedLabel(kind, lang)}`,
		description: siteConfig.description,
		site: siteConfig.url,
		items,
		xmlns: { atom: "http://www.w3.org/2005/Atom" },
		// Language describes the original writing; changing the interface does not translate it.
		customData: `<language>${escapeXml(siteConfig.lang)}</language><atom:link href="${escapeXml(new URL(feedPath(kind, lang), siteConfig.url).href)}" rel="self" type="application/rss+xml"/>`,
	});
}
