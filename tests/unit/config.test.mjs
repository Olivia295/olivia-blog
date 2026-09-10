import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { mergeSettings, parseSettings, readSettings } from "../../src/data/settings.ts";

const neutral = JSON.parse(
	await readFile(new URL("../../sample/site/site.json", import.meta.url), "utf8"),
);
async function fixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), "ship-config-"));
	await mkdir(path.join(root, "sample/site"), { recursive: true });
	await mkdir(path.join(root, "src/content/site"), { recursive: true });
	await writeFile(path.join(root, "sample/site/site.json"), JSON.stringify(neutral));
	return root;
}
test("central configuration preserves partial translations and intentional empty lists", () => {
	const result = parseSettings(
		mergeSettings(neutral, {
			profile: { name: "New captain", links: [], facts: { zh: [] }, bio: { zh: [] } },
			colors: { light: { accent: "#123456" } },
		}),
	);
	assert.equal(result.profile.name, "New captain");
	assert.deepEqual(result.profile.bio.zh, []);
	assert.deepEqual(result.profile.facts.zh, []);
	assert.equal(result.profile.bio.en.length, 2);
	assert.equal(result.colors.light.accent, "#123456");
	assert.equal(result.colors.dark.accent, neutral.colors.dark.accent);
});
test("invalid colors, site URLs, links and settings are rejected", () => {
	for (const over of [
		{ colors: { light: { accent: "red;display:none" } } },
		{ url: "not-url" },
		{ recentLimit: 0 },
		{ boarding: "false" },
		{ home: { notes: 0 } },
		{ home: { articles: 21 } },
		{ scene: { motion: "false" } },
		{ profile: { links: [{ id: "x", label: "Bad", href: "javascript:alert(1)" }] } },
	])
		assert.throws(() => parseSettings(mergeSettings(neutral, over)));
});
test("homepage defaults and partial owner settings preserve 3 notes, 5 articles and motion", () => {
	const result = parseSettings(
		mergeSettings(neutral, {
			home: { portraitAlt: { zh: "原来的插画" } },
			scene: { motion: false },
		}),
	);
	assert.equal(result.home.notes, 3);
	assert.equal(result.home.articles, 5);
	assert.equal(result.home.portraitAlt.zh, "原来的插画");
	assert.equal(result.scene.motion, false);
});
test("sample and bare modes never read personal identity or settings", async () => {
	const root = await fixture();
	try {
		await writeFile(
			path.join(root, "spaceship.config.json"),
			JSON.stringify({ ...neutral, title: "PRIVATE ROOT" }),
		);
		await writeFile(
			path.join(root, "src/content/site/site.json"),
			JSON.stringify({ title: "PRIVATE OVERLAY", author: "PRIVATE NAME", boarding: false }),
		);
		assert.equal(readSettings(root, {}).title, "PRIVATE OVERLAY");
		assert.equal(readSettings(root, { CONTENT_MODE: "sample" }).title, neutral.title);
		assert.equal(readSettings(root, { BARE: "1" }).author, neutral.author);
		await writeFile(path.join(root, ".content-state.json"), JSON.stringify({ mode: "sample" }));
		assert.equal(readSettings(root, {}).title, neutral.title);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test("central profile overrides legacy about data and can clear social links", async () => {
	const root = await fixture();
	try {
		await writeFile(
			path.join(root, "src/content/site/about.json"),
			JSON.stringify({
				name: "Legacy",
				links: [{ id: "old", label: "Old", href: "https://example.com", icon: "mdi:link-variant" }],
			}),
		);
		await writeFile(
			path.join(root, "src/content/site/site.json"),
			JSON.stringify({ profile: { name: "Captain", links: [] }, sections: { gallery: false } }),
		);
		const result = readSettings(root, {});
		assert.equal(result.profile.name, "Captain");
		assert.deepEqual(result.profile.links, []);
		assert.equal(result.sections.gallery, false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
