import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { rewriteRelativeMedia, runSync, syncContent } from "../../scripts/sync-content.mjs";

const svg =
	'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#987"/></svg>';
async function setup() {
	const dir = await mkdtemp(path.join(os.tmpdir(), "ship-sync-"));
	const root = path.join(dir, "website");
	const source = path.join(dir, "content");
	await mkdir(root);
	await mkdir(source);
	return { dir, root, source };
}
async function put(root, file, data) {
	const target = path.join(root, file);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, data);
}
test("modern posts-only input stays short-form, without legacy guessing", async () => {
	const f = await setup();
	try {
		await put(f.source, "post/note/index.md", "---\npublishDate: 2026-09-01T00:00:00Z\n---\nHi");
		await syncContent(f);
		assert.ok(existsSync(path.join(f.root, "src/content/post/note/index.md")));
		assert.ok(!existsSync(path.join(f.root, "src/content/blog/note/index.md")));
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("switching source clears missing collections, profile, media and gallery", async () => {
	const f = await setup();
	try {
		await put(f.source, "blog/old/index.md", "---\ntitle: Old\n---\n![old](old.svg)");
		await put(f.source, "blog/old/old.svg", svg);
		await put(f.source, "post/old/index.md", "A note");
		await put(f.source, "site/site.json", '{"title":"Private identity"}');
		await put(
			f.source,
			"gallery/old/album.json",
			'{"title":"Old album","updatedDate":"2026-09-01"}',
		);
		await put(f.source, "gallery/old/old.svg", svg);
		await syncContent(f);
		assert.ok(existsSync(path.join(f.root, "public/blog/old/old.svg")));
		await put(f.root, ".astro/data-store.json", "stale content cache");
		await put(f.root, "node_modules/.astro/data-store.json", "stale build cache");
		const next = path.join(f.dir, "next");
		await mkdir(next);
		await put(next, "blog/new/index.md", "New content");
		await syncContent({ ...f, source: next });
		for (const file of [
			"src/content/blog/old/index.md",
			"src/content/post/old/index.md",
			"src/content/site/site.json",
			"public/site/site.json",
			"public/gallery/old/old.svg",
			"public/blog/old/old.svg",
		])
			assert.equal(existsSync(path.join(f.root, file)), false, file);
		assert.deepEqual(
			JSON.parse(await readFile(path.join(f.root, "src/data/photos.json"), "utf8")),
			{ albums: [] },
		);
		assert.ok(existsSync(path.join(f.source, "blog/old/index.md")), "Source was not modified");
		assert.equal(existsSync(path.join(f.root, ".astro/data-store.json")), false);
		assert.equal(existsSync(path.join(f.root, "node_modules/.astro/data-store.json")), false);
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("invalid source or malformed album cannot erase the last valid import", async () => {
	const f = await setup();
	try {
		await put(f.source, "blog/keep/index.md", "Keep me");
		await syncContent(f);
		await assert.rejects(
			() => syncContent({ ...f, source: path.join(f.dir, "missing") }),
			/does not exist/,
		);
		await put(f.source, "gallery/bad/album.json", "{broken json");
		await assert.rejects(() => syncContent(f));
		assert.equal(
			await readFile(path.join(f.root, "src/content/blog/keep/index.md"), "utf8"),
			"Keep me",
		);
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("gallery preserves explicit dates, useful alt text, size and no invented dates", async () => {
	const f = await setup();
	try {
		await put(
			f.source,
			"gallery/a/album.json",
			JSON.stringify({
				title: "A",
				updatedDate: "2026-09-02",
				photoDetails: { "view.svg": { alt: "A quiet view" } },
			}),
		);
		await put(f.source, "gallery/a/view.svg", svg);
		await put(f.source, "gallery/b/view.svg", svg);
		await syncContent(f);
		const { albums } = JSON.parse(
			await readFile(path.join(f.root, "src/data/photos.json"), "utf8"),
		);
		assert.equal(albums[0].updatedDate, "2026-09-02");
		assert.equal(albums[0].photos[0].alt, "A quiet view");
		assert.equal(albums[0].photos[0].width, 120);
		assert.equal(albums[1].updatedDate, undefined);
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("unsafe and duplicate album slugs fail before any destination changes", async () => {
	const f = await setup();
	try {
		await put(f.source, "gallery/a/album.json", '{"slug":"../escape"}');
		await put(f.source, "gallery/a/view.svg", svg);
		await assert.rejects(() => syncContent(f), /slug/);
		await put(f.source, "gallery/a/album.json", '{"slug":"same"}');
		await put(f.source, "gallery/b/album.json", '{"slug":"same"}');
		await put(f.source, "gallery/b/view.svg", svg);
		await assert.rejects(() => syncContent(f), /slug/);
		assert.equal(existsSync(path.join(f.root, "src/data/photos.json")), false);
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("sample mode overrides explicit personal paths and honors deletions on repeated sync", async () => {
	const f = await setup();
	try {
		await put(f.root, "sample/post/example/index.md", "Example");
		await put(f.source, "post/private/index.md", "Private");
		await runSync(f.root, { CONTENT_MODE: "sample", CONTENT_DIR: f.source });
		assert.ok(!existsSync(path.join(f.root, "src/content/post/private/index.md")));
		await rm(path.join(f.root, "sample/post"), { recursive: true });
		await runSync(f.root, { CONTENT_MODE: "sample" });
		assert.ok(!existsSync(path.join(f.root, "src/content/post/example/index.md")));
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("explicit legacy mode supports former post/note structure", async () => {
	const f = await setup();
	try {
		await put(f.source, "post/article/index.md", "Long form");
		await put(f.source, "note/short/index.md", "Short form");
		await syncContent({ ...f, legacy: true });
		assert.ok(existsSync(path.join(f.root, "src/content/blog/article/index.md")));
		assert.ok(existsSync(path.join(f.root, "src/content/post/short/index.md")));
	} finally {
		await rm(f.dir, { recursive: true, force: true });
	}
});
test("nested media are retained, content links stay links, traversal is rejected", () => {
	assert.equal(
		rewriteRelativeMedia(
			"![a](images/a.png) [blog](../other/) [remote](https://example.com/a.png)",
			"/blog/one",
		),
		"![a](/blog/one/images/a.png) [blog](../other/) [remote](https://example.com/a.png)",
	);
	assert.throws(() => rewriteRelativeMedia("![a](../secret.png)", "/blog/one"), /inside/);
});
