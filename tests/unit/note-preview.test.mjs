import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlNotePreview, notePreview } from "../../src/data/note-preview.ts";

test("note summaries retain readable prose, resolve images and omit scripts", async () => {
	const result = await notePreview(
		'Hello **world**. [Read more](/zh/blogs/)\n\n![Landscape](./land.jpg)\n\n<div>A quiet day.<img src="/gallery/p.jpg" alt="Light &amp; shade"></div><script>alert(1)</script>',
		"a-note",
	);
	assert.equal(result.text, "Hello world. Read more A quiet day.");
	assert.deepEqual(result.photos, [
		{ src: "/post/a-note/land.jpg", alt: "Landscape" },
		{ src: "/gallery/p.jpg", alt: "Light & shade" },
	]);
});
test("reference images, image-only and empty notes have stable previews", async () => {
	assert.deepEqual(await notePreview("", "empty"), { text: "", html: "", photos: [] });
	const result = await notePreview("![View][v]\n\n[v]: https://example.com/view.jpg", "ref");
	assert.equal(result.photos[0].src, "https://example.com/view.jpg");
	assert.equal(result.text, "");
	assert.equal(result.html, "");
	const linked = await notePreview("[![View](./view.jpg)](https://example.com/view)", "ref");
	assert.equal(linked.html, "");
	assert.deepEqual(linked.photos, [{ src: "/post/ref/view.jpg", alt: "View" }]);
});

test("rendered entry previews keep actual component output and source-directory photos", async () => {
	const result = await htmlNotePreview(
		'<p>MDX 实际正文 <strong>Title &amp; creator</strong></p><img src="./view.svg?size=2#photo" alt="An MDX image"><img src="/post/absolute.jpg" alt="Absolute"><img src="http://" alt="Invalid"><script>export const message = "secret";</script><span hidden>Hidden content</span><div aria-hidden="true">Hidden label</div><template>Hidden template</template>',
		{
			id: "different-slug",
			collection: "post",
			filePath: "src/content/post/2026/nested/index.mdx",
		},
	);
	assert.equal(result.text, "MDX 实际正文 Title & creator");
	assert.match(result.html, /<p>MDX 实际正文 <strong>Title &#x26; creator<\/strong><\/p>/);
	assert.doesNotMatch(result.html, /<img|secret|Hidden/);
	assert.deepEqual(result.photos, [
		{ src: "/post/2026/nested/view.svg?size=2#photo", alt: "An MDX image" },
		{ src: "/post/absolute.jpg", alt: "Absolute" },
	]);
});

test("excerpt previews preserve Markdown structure without duplicating their photos", async () => {
	const result = await notePreview(
		"一段引言。\n\n> 引用里的 **重点** 和 *语气*。\n>\n> 第二段 [原文](https://example.com/essay)。\n\n自己的感想。\n\n![照片](./view.jpg)",
		"quote",
	);
	assert.match(result.html, /<p>一段引言。<\/p>/);
	assert.match(
		result.html,
		/<blockquote>\s*<p>引用里的 <strong>重点<\/strong> 和 <em>语气<\/em>。<\/p>\s*<p>第二段 <a href="https:\/\/example.com\/essay">原文<\/a>。<\/p>\s*<\/blockquote>/,
	);
	assert.match(result.html, /<p>自己的感想。<\/p>/);
	assert.doesNotMatch(result.html, /<img/);
	assert.deepEqual(result.photos, [{ src: "/post/quote/view.jpg", alt: "照片" }]);
});

test("rich previews sanitize links and resolve them against the note's canonical page", async () => {
	const result = await htmlNotePreview(
		'<blockquote onclick="evil()"><p><a href="javascript:evil()">Plain label</a> <a href="../blogs/?ref=note#part" target="_blank" onmouseover="evil()">Writing</a> <em style="color:red">Emphasis</em></p></blockquote><iframe src="https://example.com/player">Hidden player</iframe><img src="./photo.jpg" alt="Photo">',
		{ id: "nested-note", collection: "post", filePath: "src/content/post/nested/index.mdx" },
		"https://example.org/zh/posts/#post-nested-note",
	);
	assert.match(
		result.html,
		/<blockquote><p>Plain label <a href="https:\/\/example.org\/zh\/blogs\/\?ref=note#part">Writing<\/a> <em>Emphasis<\/em><\/p><\/blockquote>/,
	);
	assert.doesNotMatch(
		result.html,
		/javascript:|onclick|onmouseover|target=|style=|<iframe|Hidden player|<img/,
	);
	assert.deepEqual(result.photos, [{ src: "/post/nested/photo.jpg", alt: "Photo" }]);
});
