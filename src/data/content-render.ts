import type { CollectionEntry } from "astro:content";

type Entry = CollectionEntry<"blog"> | CollectionEntry<"post">;

/** Match the media directory copied by sync, including flat files and nested folders. */
export function contentMediaBase(
	entry: { collection: "blog" | "post"; id: string; filePath?: string | undefined },
	site: string,
): string {
	const source = entry.filePath?.replace(/\\/g, "/").split(`src/content/${entry.collection}/`)[1];
	const directory = source ? source.slice(0, source.lastIndexOf("/") + 1) : `${entry.id}/`;
	return new URL(
		`/${entry.collection}/${directory.split("/").map(encodeURIComponent).join("/")}`,
		site,
	).href;
}

/** Render the same compiled Markdown/MDX component used by the page. */
export async function renderEntryHtml(
	entry: Entry,
	pagePath: string,
	site: string,
): Promise<string> {
	const [{ render }, { experimental_AstroContainer: AstroContainer }, { default: mdxRenderer }] =
		await Promise.all([
			import("astro:content"),
			import("astro/container"),
			import("@astrojs/mdx/server.js"),
		]);
	const container = await AstroContainer.create({ astroConfig: { site } });
	container.addServerRenderer({ name: "astro:jsx", renderer: mdxRenderer });
	const { Content } = await render(entry);
	return container.renderToString(Content, { request: new Request(new URL(pagePath, site)) });
}
