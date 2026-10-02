import assert from "node:assert/strict";
import { test } from "node:test";
import {
	expandSeries,
	normalizeSeries,
	parseSeriesCatalog,
	resolveSeries,
	seriesPath,
} from "../../src/data/series.ts";

const rows = [
	{ id: "icy-era", zh: "冷冰时代", en: "Icy Era", aliases: ["冻冰时代"], legacyTags: ["icy era"] },
];
test("series resolves bilingual names and historical aliases to one stable identity", () => {
	const catalog = parseSeriesCatalog(rows);
	for (const name of ["冷冰时代", "冻冰时代", " Icy Era ", "icy-era", "ICY ERA"])
		assert.equal(resolveSeries(catalog, name).id, "icy-era");
	assert.equal(resolveSeries(catalog, "新系列").zh, "新系列");
	assert.deepEqual(parseSeriesCatalog({ order: ["旧系列"] })[0], {
		id: "旧系列",
		zh: "旧系列",
		en: "旧系列",
		aliases: [],
		legacyTags: [],
	});
});
test("series rejects ambiguous names and incomplete translations", () => {
	assert.throws(
		() => parseSeriesCatalog([...rows, { id: "other", zh: "其他", en: "Icy Era" }]),
		/Ambiguous/,
	);
	assert.throws(() => parseSeriesCatalog([{ id: "icy", zh: "冷冰时代" }]), /needs en/);
	assert.throws(() => parseSeriesCatalog([{ id: "all", zh: "所有", en: "Everything" }]), /Invalid/);
});
test("series descriptions are optional localized plain text", () => {
	assert.deepEqual(
		parseSeriesCatalog([{ ...rows[0], description: { zh: "  一段回忆  " } }])[0].description,
		{ zh: "一段回忆" },
	);
	assert.throws(
		() => parseSeriesCatalog([{ ...rows[0], description: { en: 7 } }]),
		/invalid description/,
	);
});

const hierarchy = [
	{ id: "icy-era", zh: "冷冰时代", en: "Icy Era", parent: "era-memoirs", aliases: ["冻冰时代"] },
	{ id: "nexus-codex", zh: "枢纽宝典", en: "Nexus Codex" },
	{ id: "era-memoirs", zh: "时代回忆录", en: "Era Memoirs", aliases: ["旧时代总集"] },
	{ id: "early-icy", zh: "更早的记忆", en: "Early Memories", parent: "icy-era" },
	{ id: "jade-era", zh: "绿玉时代", en: "Jade Era", parent: "era-memoirs" },
	{ id: "embodied-records", zh: "具身详记", en: "Embodied Records" },
	{ id: "game-reviews", zh: "游戏评测", en: "Game Reviews", parent: "embodied-records" },
];

test("series catalogs keep parents before descendants and preserve sibling order", () => {
	const catalog = parseSeriesCatalog(hierarchy);
	assert.deepEqual(
		catalog.map((entry) => entry.id),
		[
			"nexus-codex",
			"era-memoirs",
			"icy-era",
			"early-icy",
			"jade-era",
			"embodied-records",
			"game-reviews",
		],
	);
	assert.equal(catalog.find((entry) => entry.id === "game-reviews").parent, "embodied-records");
	assert.deepEqual(
		hierarchy.map((entry) => entry.id),
		[
			"icy-era",
			"nexus-codex",
			"era-memoirs",
			"early-icy",
			"jade-era",
			"embodied-records",
			"game-reviews",
		],
	);
});

test("parent references require a nonempty existing stable id", () => {
	const parent = { id: "parent", zh: "父系列", en: "Parent", aliases: ["old-parent"] };
	for (const invalid of ["missing", "父系列", "old-parent"])
		assert.throws(
			() =>
				parseSeriesCatalog([parent, { id: "child", zh: "子系列", en: "Child", parent: invalid }]),
			/Unknown parent/,
		);
	for (const invalid of ["", "  ", 7, null, []])
		assert.throws(() => parseSeriesCatalog([{ ...parent, parent: invalid }]), /invalid parent/);
	assert.equal(
		parseSeriesCatalog([parent, { id: "child", zh: "子系列", en: "Child", parent: " parent " }])[1]
			.parent,
		"parent",
	);
});

test("series reject self references and indirect parent cycles before navigation is built", () => {
	assert.throws(
		() => parseSeriesCatalog([{ id: "self", zh: "自指", en: "Self", parent: "self" }]),
		/Circular/,
	);
	assert.throws(
		() =>
			parseSeriesCatalog([
				{ id: "a", zh: "甲", en: "A", parent: "b" },
				{ id: "b", zh: "乙", en: "B", parent: "c" },
				{ id: "c", zh: "丙", en: "C", parent: "a" },
			]),
		/Circular/,
	);
});

test("series paths resolve aliases and include every ancestor in root-to-leaf order", () => {
	const catalog = parseSeriesCatalog(hierarchy);
	for (const name of ["icy-era", "冷冰时代", "冻冰时代", " ICY ERA "])
		assert.deepEqual(
			seriesPath(catalog, name).map((entry) => entry.id),
			["era-memoirs", "icy-era"],
		);
	assert.deepEqual(
		seriesPath(catalog, "Early Memories").map((entry) => entry.id),
		["era-memoirs", "icy-era", "early-icy"],
	);
	assert.deepEqual(
		seriesPath(catalog, "旧时代总集").map((entry) => entry.id),
		["era-memoirs"],
	);
	assert.deepEqual(
		seriesPath(catalog, "未收录系列").map((entry) => entry.zh),
		["未收录系列"],
	);
});

test("ancestor expansion includes a parent with no direct article once across parallel children", () => {
	const catalog = parseSeriesCatalog(hierarchy);
	assert.deepEqual(
		expandSeries(catalog, ["冻冰时代", "Jade Era", "icy-era", "旧时代总集"]).map(
			(entry) => entry.id,
		),
		["era-memoirs", "icy-era", "jade-era"],
	);
	assert.deepEqual(
		expandSeries(catalog, ["early-icy"]).map((entry) => entry.id),
		["era-memoirs", "icy-era", "early-icy"],
	);
	assert.deepEqual(expandSeries(catalog, []), []);
});

test("normalization keeps specific authored series without redundant parents or aliases", () => {
	const catalog = parseSeriesCatalog(hierarchy);
	const names = ["枢纽宝典", "旧时代总集", "冻冰时代", "Jade Era", "icy-era", "未知系列"];
	assert.deepEqual(normalizeSeries(catalog, names), [
		"枢纽宝典",
		"冷冰时代",
		"绿玉时代",
		"未知系列",
	]);
	assert.deepEqual(normalizeSeries(catalog, ["era-memoirs", "icy-era", "early-icy"]), [
		"更早的记忆",
	]);
	assert.deepEqual(normalizeSeries(catalog, ["时代回忆录", "nexus-codex"]), [
		"时代回忆录",
		"枢纽宝典",
	]);
	assert.deepEqual(normalizeSeries(catalog, ["冷冰时代"]), ["冷冰时代"]);
	assert.deepEqual(normalizeSeries(catalog, []), []);
	assert.equal(names.length, 6);
});
