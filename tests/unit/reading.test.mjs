import assert from "node:assert/strict";
import { test } from "node:test";
import { seriesNeighbors } from "../../src/data/reading.ts";
import { parseSeriesCatalog } from "../../src/data/series.ts";
import { generateToc } from "../../src/utils/generateToc.ts";

const post = (id, day, series = ["生活"], draft = false) => ({
	id,
	data: { publishDate: new Date(`2026-01-${day}T00:00:00Z`), series, draft },
});

test("reading navigation uses each series, publication date and a stable tie-break without drafts", () => {
	const current = post("b", "02", ["生活", "旅行", "生活"]);
	const earlier = post("earlier", "01");
	const sameDayBefore = post("a", "02");
	const sameDayAfter = post("c", "02");
	const travel = post("travel", "03", ["旅行"]);
	const draft = post("ba", "02", ["生活"], true);
	const posts = [travel, sameDayAfter, draft, current, earlier, sameDayBefore];
	assert.deepEqual(seriesNeighbors(current, posts), [
		{ name: "生活", previous: sameDayBefore, next: sameDayAfter },
		{ name: "旅行", previous: undefined, next: travel },
	]);
	assert.deepEqual(seriesNeighbors(current, [...posts].reverse()), seriesNeighbors(current, posts));
	assert.deepEqual(seriesNeighbors(draft, posts), []);
	assert.deepEqual(seriesNeighbors(post("solo", "01", []), posts), []);
	assert.equal(seriesNeighbors(earlier, posts)[0].previous, undefined);
	assert.equal(seriesNeighbors(sameDayAfter, posts)[0].next, undefined);
	assert.deepEqual(seriesNeighbors(post("missing", "01"), posts), [
		{ name: "生活", previous: undefined, next: undefined },
	]);
});

test("non-TOC headings do not create an empty reading column", () => {
	assert.deepEqual(
		generateToc([
			{ depth: 1, text: "Title", slug: "title" },
			{ depth: 5, text: "Note", slug: "note" },
		]),
		[],
	);
	assert.equal(generateToc([{ depth: 2, text: "Start", slug: "start" }]).length, 1);
});

test("reading prioritizes the child series and also connects its parent overview", () => {
	const catalog = parseSeriesCatalog([
		{ id: "memoirs", zh: "回忆录", en: "Memoirs" },
		{ id: "ice", zh: "冷冰", en: "Ice", parent: "memoirs" },
		{ id: "gold", zh: "黄金", en: "Gold", parent: "memoirs" },
	]);
	const overview = post("overview", "01", ["回忆录"]);
	const current = post("ice-1", "02", ["冷冰"]);
	const sibling = post("gold-1", "03", ["黄金"]);
	const next = post("ice-2", "04", ["冷冰"]);
	const result = seriesNeighbors(current, [next, overview, sibling, current], catalog);
	assert.equal(result[0].name, "冷冰");
	assert.equal(result[0].next, next);
	assert.equal(result[1].previous, overview);
	assert.equal(result[1].next, sibling);
	assert.equal(seriesNeighbors(overview, [overview, current], catalog)[0].next, current);
});
