import type { CollectionEntry } from "astro:content";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { Element, Root, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import rehypeRaw from "rehype-raw";
import { unified } from "unified";
import { contentMediaBase, renderEntryHtml } from "./content-render.ts";
import { feedContent } from "./feed-content.ts";

export interface NotePreview {
	text: string;
	html: string;
	photos: { src: string; alt: string }[];
}

const processor = createMarkdownProcessor({ syntaxHighlight: false, smartypants: false });

/** Raw Markdown helper for callers that do not have a content collection entry. */
export async function notePreview(body: string, id: string): Promise<NotePreview> {
	const rendered = await (await processor).render(body);
	return htmlNotePreview(rendered.code, { id, collection: "post" });
}

export async function entryPreview(
	entry: CollectionEntry<"post">,
	pagePath: string,
	site: string,
): Promise<NotePreview> {
	return htmlNotePreview(
		await renderEntryHtml(entry, pagePath, site),
		entry,
		new URL(pagePath, site).href,
	);
}

/** Extract actual rendered output, never MDX imports, expressions or JSX source. */
export async function htmlNotePreview(
	html: string,
	entry: { id: string; collection: "post"; filePath?: string | undefined },
	pageUrl = "https://local.invalid/",
): Promise<NotePreview> {
	const tree = await unified()
		.use(rehypeRaw)
		.run({ type: "root", children: [{ type: "raw", value: html }] } as Root);
	const result: NotePreview = { text: "", html: "", photos: [] };
	const walk = (node: RootContent): RootContent[] => {
		if (node.type === "text") result.text += node.value;
		if (node.type === "element") {
			if (
				["script", "style", "template", "iframe", "audio", "video"].includes(node.tagName) ||
				node.properties.hidden ||
				node.properties.ariaHidden === "true"
			)
				return [];
			if (node.tagName === "img") {
				const src = String(node.properties.src ?? "");
				if (/^(https?:\/\/|\/(?!\/)|\.?\.?\/)/i.test(src) || /^[\w%-][^:]*$/.test(src)) {
					try {
						const url = new URL(src, contentMediaBase(entry, "https://local.invalid/"));
						if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password)
							result.photos.push({
								src: /^(https?:\/\/)/i.test(src)
									? url.href
									: `${url.pathname}${url.search}${url.hash}`,
								alt: String(node.properties.alt ?? ""),
							});
					} catch {
						// An invalid image must not prevent the remaining note from appearing.
					}
				}
				return [];
			}
			node.children = node.children.flatMap(walk) as Element["children"];
			if (
				!["br", "hr"].includes(node.tagName) &&
				node.children.every((child) => child.type === "text" && !child.value.trim())
			)
				return [];
		}
		if (
			node.type === "element" &&
			["p", "div", "li", "br", "blockquote", "h1", "h2", "h3", "pre"].includes(node.tagName)
		)
			result.text += " ";
		return [node];
	};
	tree.children = tree.children.flatMap(walk);
	result.text = result.text.replace(/\s+/g, " ").trim();
	// Share the feed's HTML/URL sanitizer; photos remain in the existing thumbnail preview.
	result.html = (
		await feedContent(toHtml(tree), {
			pageUrl,
			mediaUrl: contentMediaBase(entry, pageUrl),
			lang: "zh",
		})
	).html.trim();
	return result;
}
