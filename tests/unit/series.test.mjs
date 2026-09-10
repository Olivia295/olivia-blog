import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSeriesCatalog, resolveSeries } from "../../src/data/series.ts";

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
