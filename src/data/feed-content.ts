import type { Element, Root, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import { h } from "hastscript";
import rehypeRaw from "rehype-raw";
import { unified } from "unified";
import { type Recommendation, recommendationCover } from "./recommendation.ts";

export type FeedKind = "all" | "blogs" | "posts";
const labels = {
	zh: { all: "全部更新", blogs: "文章", posts: "随记" },
	en: { all: "All updates", blogs: "Writing", posts: "Notes" },
};
export function feedLabel(kind: FeedKind, lang: "zh" | "en") {
	return labels[lang][kind];
}
export function feedPath(kind: FeedKind, lang: "zh" | "en") {
	return `/${lang}/${kind === "all" ? "feed.xml" : kind === "blogs" ? "rss.xml" : "posts/rss.xml"}`;
}

const allowed = new Set(
	"a abbr b blockquote br caption code dd del details div dl dt em figcaption figure h1 h2 h3 h4 h5 h6 hr i img kbd li mark ol p pre s section small span strong sub summary sup table tbody td th thead tr ul".split(
		" ",
	),
);
const discard = new Set(
	"script style template noscript form input button select textarea svg math object embed link meta head".split(
		" ",
	),
);
const blocks = new Set(
	"blockquote caption dd div dl dt figcaption figure h1 h2 h3 h4 h5 h6 hr li ol p pre section table td th tr ul br".split(
		" ",
	),
);

export function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function safeUrl(value: unknown, base: string, resource = false): string | undefined {
	if (typeof value !== "string" || !value.trim()) return undefined;
	try {
		const url = new URL(value, base);
		if (url.username || url.password) return undefined;
		if (["https:", "http:", ...(!resource ? ["mailto:", "tel:"] : [])].includes(url.protocol))
			return url.href;
	} catch {
		/* Invalid URLs become plain text rather than broken feed links. */
	}
	return undefined;
}

/** Keep the original identity even after notes acquire a working standalone URL. */
export function feedGuid(kind: "blog" | "post", id: string, lang: string, site: string): string {
	// The old RSS library added a slash after extensionless fragments, but not dotted IDs.
	const suffix = id.includes(".") ? "" : "/";
	const path = kind === "blog" ? `/${lang}/blogs/${id}/` : `/${lang}/posts/#post-${id}${suffix}`;
	return new URL(path, site).href;
}

export function publishedFeedEntries<
	T extends { id: string; collection: string; data: { draft?: boolean; publishDate: Date } },
>(entries: T[]): T[] {
	return entries
		.filter((entry) => !entry.data.draft)
		.sort(
			(a, b) =>
				b.data.publishDate.getTime() - a.data.publishDate.getTime() ||
				`${a.collection}:${a.id}`.localeCompare(`${b.collection}:${b.id}`),
		);
}

export function feedSummary(description: string | undefined, text: string): string {
	const preferred = description?.trim();
	const value = preferred && !/^\/+$/u.test(preferred) ? preferred : text;
	const characters = Array.from(value.replace(/\s+/gu, " ").trim());
	return characters.length > 180 ? `${characters.slice(0, 180).join("")}…` : characters.join("");
}

/** Notes are written once: RSS labels come from the work title or rendered body. */
export function postFeedMetadata(
	text: string,
	publishDate: Date,
	lang: "zh" | "en",
	recommendationTitle?: string,
) {
	const description = feedSummary(undefined, text);
	const characters = Array.from(description);
	const bodyTitle = `${characters.slice(0, 50).join("")}${characters.length > 50 ? "…" : ""}`;
	return {
		title:
			recommendationTitle ||
			bodyTitle ||
			`${feedLabel("posts", lang)} · ${publishDate.toISOString().slice(0, 10)}`,
		description,
	};
}

/** Sanitize rendered HTML as a tree, so MDX and custom HTML keep their actual output. */
export async function feedContent(
	html: string,
	options: {
		pageUrl: string;
		mediaUrl: string;
		lang: "zh" | "en";
		recommendation?: Recommendation | undefined;
	},
): Promise<{ html: string; text: string }> {
	const { pageUrl, mediaUrl, lang, recommendation } = options;
	const parsed = await unified()
		.use(rehypeRaw)
		.run({ type: "root", children: [{ type: "raw", value: html }] } as Root);
	if (recommendation) {
		const cover = await recommendationCover(recommendation);
		const kind = {
			music: lang === "zh" ? "音乐" : "Music",
			book: lang === "zh" ? "书籍" : "Book",
			movie: lang === "zh" ? "电影" : "Film",
		}[recommendation.kind];
		const card: Element = h("section", [
			h(
				"p",
				`${kind} · ${recommendation.title}${recommendation.creator ? ` — ${recommendation.creator}` : ""}`,
			),
			...(cover ? [h("img", { src: cover, alt: recommendation.title })] : []),
			h("p", [h("a", { href: recommendation.url }, lang === "zh" ? "查看作品" : "View work")]),
			...(recommendation.audio
				? [
						h("p", [
							h(
								"a",
								{ href: safeUrl(recommendation.audio, mediaUrl, true) },
								lang === "zh" ? "收听音频" : "Listen to audio",
							),
						]),
					]
				: []),
		]);
		parsed.children.unshift(card);
	}
	const clean = (node: RootContent): RootContent[] => {
		if (node.type === "text") return [node];
		if (
			node.type !== "element" ||
			discard.has(node.tagName) ||
			node.properties.hidden ||
			node.properties.ariaHidden === "true"
		)
			return [];
		if (["audio", "video", "iframe"].includes(node.tagName)) {
			const source =
				node.properties.src ??
				node.children.find(
					(child): child is Element => child.type === "element" && child.tagName === "source",
				)?.properties.src;
			const url = safeUrl(source, node.tagName === "iframe" ? pageUrl : mediaUrl, true);
			return url
				? [
						h("p", [
							h(
								"a",
								{ href: url },
								String(node.properties.title || (lang === "zh" ? "打开媒体" : "Open media")),
							),
						]),
					]
				: node.children.flatMap(clean);
		}
		const children = node.children.flatMap(clean) as Element["children"];
		if (!allowed.has(node.tagName)) return children;
		const properties: Element["properties"] = {};
		for (const key of ["id", "title", "lang", "dir", "alt", "colSpan", "rowSpan", "start", "scope"])
			if (node.properties[key] !== undefined) properties[key] = node.properties[key];
		if (node.tagName === "a") {
			const href = safeUrl(node.properties.href, pageUrl);
			if (!href) return children;
			properties.href = href;
		}
		if (node.tagName === "img") {
			const src = safeUrl(node.properties.src, mediaUrl, true);
			if (!src)
				return node.properties.alt ? [{ type: "text", value: String(node.properties.alt) }] : [];
			properties.src = src;
			properties.alt ??= "";
		}
		return [{ type: "element", tagName: node.tagName, properties, children }];
	};
	const tree: Root = { type: "root", children: parsed.children.flatMap(clean) };
	const plain = (node: Root | RootContent): string => {
		if (node.type === "text") return node.value;
		if (node.type !== "root" && node.type !== "element") return "";
		return (
			node.children.map(plain).join("") +
			(node.type === "element" && blocks.has(node.tagName) ? " " : "")
		);
	};
	return { html: toHtml(tree), text: plain(tree).replace(/\s+/gu, " ").trim() };
}
