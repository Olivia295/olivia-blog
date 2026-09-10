import assert from "node:assert/strict";
import { test } from "node:test";
import { contentDate, sortTimeline } from "../../src/data/timeline.ts";

test("mixed shares sort by absolute time, not content type or timezone", () => {
	const input = [
		{ key: "blog-old", date: contentDate("2026-09-01") },
		{ key: "post-new", date: contentDate("2026-09-09T12:00:00Z") },
		{ key: "album-newer", date: contentDate("2026-09-09T23:00:00+10:00") },
	];
	assert.deepEqual(
		sortTimeline(input).map((x) => x.key),
		["album-newer", "post-new", "blog-old"],
	);
	assert.equal(input[0].key, "blog-old");
});
test("unknown dates stay undated and stable after dated content", () => {
	assert.equal(contentDate("nonsense"), null);
	assert.equal(contentDate(), null);
	assert.deepEqual(
		sortTimeline([
			{ key: "b", date: null },
			{ key: "new", date: contentDate("2026-09-01") },
			{ key: "a", date: null },
		]).map((x) => x.key),
		["new", "a", "b"],
	);
});
test("equal timestamps are deterministic and an empty feed is valid", () => {
	const date = contentDate("2026-09-01");
	assert.deepEqual(
		sortTimeline([
			{ key: "z", date },
			{ key: "a", date },
		]).map((x) => x.key),
		["a", "z"],
	);
	assert.deepEqual(sortTimeline([]), []);
});
