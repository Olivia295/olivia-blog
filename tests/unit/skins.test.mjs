import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readSettings, parseSettings } from "../../src/data/settings.ts";
import { skins } from "../../src/skins/registry.ts";

test("site content selects any registered skin and rejects unknown defaults", async () => {
	const base = JSON.parse(
		await readFile(new URL("../../sample/site/site.json", import.meta.url), "utf8"),
	);
	const root = await mkdtemp(path.join(tmpdir(), "blog-skin-"));
	try {
		await mkdir(path.join(root, "sample/site"), { recursive: true });
		await mkdir(path.join(root, "src/content/site"), { recursive: true });
		await writeFile(path.join(root, "sample/site/site.json"), JSON.stringify(base));
		assert.equal(readSettings(root, {}).defaultSkin, "spaceship");
		for (const skin of skins) {
			await writeFile(
				path.join(root, "src/content/site/site.json"),
				JSON.stringify({ defaultSkin: skin.id }),
			);
			assert.equal(readSettings(root, {}).defaultSkin, skin.id);
		}
		assert.throws(() => parseSettings({ ...base, defaultSkin: "missing" }), /Unknown defaultSkin/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
