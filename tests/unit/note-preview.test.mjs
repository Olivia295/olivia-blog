import assert from "node:assert/strict";
import { test } from "node:test";
import { notePreview } from "../../src/data/note-preview.ts";

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
	assert.deepEqual(await notePreview("", "empty"), { text: "", photos: [] });
	const result = await notePreview("![View][v]\n\n[v]: https://example.com/view.jpg", "ref");
	assert.equal(result.photos[0].src, "https://example.com/view.jpg");
	assert.equal(result.text, "");
});
