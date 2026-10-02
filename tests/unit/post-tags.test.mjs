import assert from "node:assert/strict";
import { test } from "node:test";
import { postBelongsToTab, postTabLabel, resolvePostTags } from "../../src/data/post-tags.ts";

test("the three note categories keep legacy aliases and the requested Chinese names", () => {
	assert.deepEqual(
		["note", "rec", "excerpt"].map((id) => postTabLabel(id, "zh")),
		["快录", "分享", "摘抄"],
	);
	assert.equal(postBelongsToTab(["随记", "快录"], "note"), true);
	assert.equal(postBelongsToTab(["推荐", "分享"], "rec"), true);
	assert.equal(postBelongsToTab(["摘抄"], "excerpt"), true);
	assert.deepEqual(resolvePostTags(["随记", "快录", "note"], "zh"), [
		{ id: "note", label: "快录" },
	]);
});
