import assert from "node:assert/strict";
import { test } from "node:test";
import { postSchema } from "../../src/data/post-schema.ts";

const publishDate = "2026-09-26T12:00:00+10:00";

test("notes need only a publication date and ignore legacy title/description fields", () => {
	const current = postSchema.parse({ publishDate });
	assert.deepEqual(current, { publishDate: new Date(publishDate), tags: [], draft: false });
	for (const legacy of [
		{ title: "Old title", description: "Old summary" },
		{ title: "", description: "//" },
		{ title: null, description: 123 },
	]) {
		assert.deepEqual(postSchema.parse({ publishDate, ...legacy }), current);
	}
});

test("a recommendation keeps its required work title and automatic share category", () => {
	const recommendation = { kind: "book", title: " A book ", url: "https://example.com/book" };
	const note = postSchema.parse({
		publishDate,
		title: "Ignored outer title",
		description: "Ignored outer summary",
		tags: [" rec ", "rec"],
		recommendation,
	});
	assert.equal(note.recommendation.title, "A book");
	assert.deepEqual(note.tags, ["rec"]);
	assert.equal("title" in note, false);
	assert.equal("description" in note, false);
	assert.equal(
		postSchema.safeParse({ publishDate, recommendation: { ...recommendation, title: "" } }).success,
		false,
	);
	assert.equal(
		postSchema.safeParse({ publishDate, recommendation: { kind: "book", url: recommendation.url } })
			.success,
		false,
	);
	assert.equal(postSchema.safeParse({}).success, false);
	assert.equal(postSchema.safeParse({ publishDate: "not a date" }).success, false);
});
