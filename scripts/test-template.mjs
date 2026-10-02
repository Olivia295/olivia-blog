import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const original = process.cwd();
const scratch = await mkdtemp(path.join(os.tmpdir(), "spaceship-template-"));
const root = path.join(scratch, "website");
const artifacts = path.join(original, "artifacts/template");
await mkdir(root);
await mkdir(artifacts, { recursive: true });
const env = { ...process.env };
for (const key of Object.keys(env))
	if (
		key.startsWith("CONTENT_") ||
		key.startsWith("WEBMENTION_") ||
		key === "PUBLIC_MEDIA_BASE_URL" ||
		key === "BARE"
	)
		delete env[key];
const files = execFileSync(
	"git",
	["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
	{ encoding: "utf8" },
)
	.split("\0")
	.filter(Boolean);
for (const file of files) {
	if (!existsSync(path.join(original, file))) continue;
	await mkdir(path.dirname(path.join(root, file)), { recursive: true });
	await cp(path.join(original, file), path.join(root, file));
}
function run(command, args, customEnv = env) {
	try {
		return execFileSync(command, args, {
			cwd: root,
			env: customEnv,
			encoding: "utf8",
			stdio: "pipe",
			maxBuffer: 20 * 1024 * 1024,
		});
	} catch (error) {
		throw new Error(
			`${command} ${args.join(" ")} failed:\n${error.stdout || ""}\n${error.stderr || ""}`,
		);
	}
}
async function html(route = "zh/index.html") {
	return readFile(path.join(root, "dist", route), "utf8");
}
let server;
let browser;
try {
	console.log("Template: installing from the lockfile in a clean directory (no sibling content).");
	run("npm", ["ci", "--no-audit", "--no-fund"]);
	console.log("Template: building the untouched sample.");
	run("npm", ["run", "build"]);
	const home = await html();
	assert.match(home, /小小飞船/);
	assert.match(home, /旅人/);
	assert.match(home, /data-kind="blog"/);
	assert.match(home, /data-kind="post"/);
	assert.doesNotMatch(home, /data-kind="album"/);
	assert.match(home, /href="\/zh\/gallery\/"/);
	assert.match(home, /最近随记/);
	assert.doesNotMatch(home, /class="[^"]*\blatest-note\b/);
	assert.match(home, /最近文章/);
	assert.match(home, /href="\/zh\/posts\/"/);
	assert.match(home, /src="\/defaults\/portrait.svg"/);
	assert.doesNotMatch(home, /Olivia|oliviapan|PRIVATE|奇怪的厨房/);
	for (const file of [
		"defaults/icon.svg",
		"defaults/portrait.svg",
		"defaults/social-card.png",
		"manifest.webmanifest",
		"icons/apple-touch-icon.png",
		"pagefind/pagefind.js",
		"zh/blogs/slow-days/index.html",
		"zh/gallery/wandering/index.html",
		"en/index.html",
	])
		assert.ok(existsSync(path.join(root, "dist", file)), `Missing template output ${file}`);
	const backdrop = home.match(/src="(\/_astro\/hangar\.[^"]+\.webp)"/)?.[1];
	assert.ok(backdrop, "Missing bundled spaceship backdrop reference");
	assert.ok(existsSync(path.join(root, "dist", backdrop)), "Missing bundled spaceship backdrop");
	await cp(path.join(root, "dist"), path.join(artifacts, "sample-dist"), { recursive: true });
	server = spawn(
		"node",
		["node_modules/astro/bin/astro.mjs", "preview", "--host", "127.0.0.1", "--port", "4322"],
		{ cwd: root, env, stdio: "pipe" },
	);
	let previewOutput = "";
	server.stdout.on("data", (chunk) => {
		previewOutput += chunk;
	});
	server.stderr.on("data", (chunk) => {
		previewOutput += chunk;
	});
	let available = false;
	for (let i = 0; i < 80; i++) {
		try {
			if ((await fetch("http://127.0.0.1:4322/zh/")).ok) {
				available = true;
				break;
			}
		} catch {}
		await new Promise((r) => setTimeout(r, 100));
	}
	assert.ok(available, `Template preview server did not start:\n${previewOutput}`);
	const chrome =
		process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
		(existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
			? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
			: undefined);
	browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
	const page = await browser.newPage({ reducedMotion: "reduce" });
	for (const width of [320, 390, 768, 1440]) {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto("http://127.0.0.1:4322/zh/");
		assert.equal(await page.locator(".latest-note").count(), 0);
		assert.equal(await page.locator(".recent-notes").count(), 1);
		assert.equal(await page.locator(".recent-articles").count(), 1);
		const noteCount = await page.locator(".note-preview").count();
		assert.ok(noteCount > 0 && noteCount <= 3);
		assert.ok((await page.locator(".article-preview").count()) <= 5);
		const notesBounds = await page.locator(".recent-notes").boundingBox();
		const articlesBounds = await page.locator(".recent-articles").boundingBox();
		assert.ok(notesBounds && articlesBounds);
		if (width >= 860) assert.ok(articlesBounds.x >= notesBounds.x + notesBounds.width);
		else assert.ok(articlesBounds.y >= notesBounds.y + notesBounds.height);
		assert.equal(await page.locator(".sample-banner").isVisible(), true);
		assert.equal(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			true,
		);
		for (const image of await page.locator("main img").all()) {
			await image.scrollIntoViewIfNeeded();
			await image.evaluate((img) => img.decode());
		}
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
		await page.screenshot({ path: path.join(artifacts, `sample-${width}.png`), fullPage: true });
	}
	await page.locator('.site-nav a[href="/zh/posts/"]').click();
	assert.match(
		await page.locator("#post-morning-light .note-card__body").innerText(),
		/今天把桌子挪到了窗边/,
	);
	await page.goto("http://127.0.0.1:4322/zh/");
	await page.locator('.log-entry[data-kind="blog"] h3 a').first().click();
	assert.equal(await page.locator(".reading-body").isVisible(), true);
	await page.getByRole("link", { name: "去相册看这次漫游留下的画面" }).click();
	const albumDescription = page.locator(".album-description");
	assert.equal(await albumDescription.count(), 1);
	assert.equal(await albumDescription.innerText(), "以原创插画代替真实照片的示例相册。");
	assert.ok(
		await albumDescription.evaluate((el) => {
			const firstPhoto = document.querySelector(".photo-figure");
			return (
				firstPhoto && el.compareDocumentPosition(firstPhoto) & Node.DOCUMENT_POSITION_FOLLOWING
			);
		}),
	);
	assert.equal(await page.locator(".photo-figure figcaption").count(), 0);
	const photoAlt = await page.locator(".photo-figure img").first().getAttribute("alt");
	assert.ok(photoAlt);
	await page.locator("[data-photo-src]").first().click();
	assert.equal(await page.locator("#photo-viewer").isVisible(), true);
	assert.equal(await page.locator(".viewer-caption").count(), 0);
	assert.equal(await page.locator(".viewer-image").getAttribute("alt"), photoAlt);
	await page.getByRole("button", { name: "关闭预览" }).click();
	await browser.close();
	browser = undefined;
	server.kill();
	server = undefined;
	console.log("Template: building another owner with a different skin and a notes-only source.");
	const source = path.join(scratch, "my-content");
	await mkdir(path.join(source, "post/hello"), { recursive: true });
	await mkdir(path.join(source, "site"), { recursive: true });
	await writeFile(
		path.join(source, "post/hello/index.md"),
		'---\npublishDate: "2026-09-09T00:00:00Z"\n---\nA new captain has arrived.',
	);
	await writeFile(
		path.join(source, "site/home-hero.svg"),
		'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520"><rect width="360" height="520" fill="#234e52"/></svg>',
	);
	await writeFile(
		path.join(source, "site/site.json"),
		JSON.stringify({
			defaultSkin: "minimal",
			title: "Another Captain",
			author: "Rowan",
			profile: { name: "Rowan", links: [] },
			intro: { zh: "我的新飞船", en: "My new ship" },
			boarding: false,
			home: {
				notes: 1,
				articles: 2,
				portraitAlt: { zh: "Rowan 的纵向插画", en: "Rowan’s portrait" },
			},
			scene: { motion: false },
			colors: { light: { accent: "#234e52" } },
			sections: { hideEmpty: true, about: false },
		}),
	);
	run("npm", ["run", "build"], { ...env, CONTENT_DIR: source });
	const custom = await html();
	await writeFile(path.join(artifacts, "custom.html"), custom);

	assert.match(custom, /Another Captain/);
	const customAbout = await readFile(path.join(root, "dist/zh/about/index.html"), "utf8");
	assert.equal(
		customAbout.includes('id="about-friends-heading"'),
		false,
		"Empty social links must hide the section",
	);
	assert.match(custom, /Rowan/);
	assert.match(custom, /data-skin="minimal"/);
	assert.doesNotMatch(custom, /--skin-brand:\s*#234e52/i, "Legacy colors must not override skins");
	assert.match(custom, /src="\/site\/home-hero.svg"/);
	assert.match(custom, /width="360" height="520"/);
	assert.match(custom, /Rowan 的纵向插画/);
	assert.match(custom, /data-space-enabled="false"/);
	assert.equal((custom.match(/data-kind="post"/g) || []).length, 1);
	assert.match(custom, /A new captain has arrived/);
	assert.match(custom, /class="[^"]*\brecent-notes\b/);
	assert.doesNotMatch(custom, /class="[^"]*\b(?:recent-articles|latest-note)\b/);
	assert.match(custom, /href="\/zh\/posts\/"/);
	assert.match(await html("zh/posts/index.html"), /A new captain has arrived/);
	assert.equal(
		/id="boarding"|小小飞船|href="\/zh\/gallery\/"|href="\/zh\/blogs\/"|href="\/zh\/about\/"/.test(
			custom,
		),
		false,
		"Custom mode must hide disabled intro, sample identity and empty sections",
	);
	assert.ok(!existsSync(path.join(root, "dist/zh/blogs/slow-days")));
	await rm(path.join(source, "post"), { recursive: true });
	await rm(path.join(source, "site/home-hero.svg"));
	run("npm", ["run", "build"], { ...env, CONTENT_DIR: source });
	const empty = await html();
	assert.doesNotMatch(empty, /class="[^"]*\brecent-columns\b|href="\/zh\/posts\/"/);
	assert.doesNotMatch(empty, /data-kind=|A new captain has arrived/);
	assert.match(empty, /src="\/defaults\/portrait.svg"/);
	assert.ok(!existsSync(path.join(root, "dist/site/home-hero.svg")));
	console.log(
		"Template: verifying sample mode after personal content, and an empty neutral shell.",
	);
	run("npm", ["run", "build"], { ...env, CONTENT_DIR: source, CONTENT_MODE: "sample" });
	const isolated = await html();
	assert.match(isolated, /小小飞船/);
	assert.doesNotMatch(isolated, /Another Captain|Rowan/);
	run("node", ["node_modules/astro/bin/astro.mjs", "build"], { ...env, BARE: "1" });
	const bare = await html();
	assert.doesNotMatch(bare, /Another Captain|Rowan|data-kind=/);
	const report = {
		passed: true,
		checks: [
			"clean npm ci",
			"fresh sample build",
			"all assets present",
			"sample privacy",
			"4 rendered widths",
			"article to album relation",
			"viewer interaction",
			"album description above caption-free photos with accessible alternatives",
			"custom name and skin with isolated palette",
			"notes-only source",
			"hide empty navigation",
			"deleted-content cleanup",
			"sample after private data",
			"bare identity isolation",
			"recent notes and writing in responsive body columns without a duplicate hero note",
			"portrait replacement with original aspect ratio",
			"deleted portrait falls back without stale media",
			"central motion, note count and article count settings",
		],
	};
	await writeFile(path.join(artifacts, "report.json"), JSON.stringify(report, null, 2) + "\n");
	console.log("Template: all clean-start, customization, isolation and browser checks passed.");
} finally {
	await browser?.close();
	server?.kill();
	await rm(scratch, { recursive: true, force: true });
}
