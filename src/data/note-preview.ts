import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { Root, RootContent } from "hast";
import rehypeRaw from "rehype-raw";

export interface NotePreview {
	text: string;
	photos: { src: string; alt: string }[];
}

/** Render to an AST at build time; previews never hide focusable full-note markup. */
const processor = createMarkdownProcessor({
	syntaxHighlight: false,
	smartypants: false,
	rehypePlugins: [
		rehypeRaw,
		() => (tree: Root, file) => {
			const result: NotePreview = { text: "", photos: [] };
			const walk = (node: Root | RootContent) => {
				if (node.type === "text") result.text += node.value;
				if (node.type === "element") {
					if (["script", "style", "iframe", "audio", "video"].includes(node.tagName)) return;
					if (node.tagName === "img") {
						const src = String(node.properties.src ?? "");
						if (/^(https?:\/\/|\/(?!\/)|\.?\.?\/)/i.test(src) || /^[\w%-][^:]*$/.test(src))
							result.photos.push({ src, alt: String(node.properties.alt ?? "") });
						return;
					}
				}
				if ("children" in node) node.children.forEach(walk);
				if (
					node.type === "element" &&
					["p", "div", "li", "br", "blockquote", "h1", "h2", "h3", "pre"].includes(node.tagName)
				)
					result.text += " ";
			};
			walk(tree);
			result.text = result.text.replace(/\s+/g, " ").trim();
			file.data.astro ??= {};
			file.data.astro.frontmatter ??= {};
			file.data.astro.frontmatter.notePreview = result;
		},
	],
});

export async function notePreview(body: string, id: string): Promise<NotePreview> {
	const rendered = await (await processor).render(body);
	const result = rendered.metadata.frontmatter.notePreview as NotePreview;
	return {
		...result,
		photos: result.photos.map((photo) => ({
			...photo,
			src: /^(https?:\/\/|\/)/i.test(photo.src)
				? photo.src
				: new URL(photo.src, `https://local.invalid/post/${id}/`).pathname,
		})),
	};
}
