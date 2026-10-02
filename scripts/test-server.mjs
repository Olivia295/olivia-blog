import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { constants, existsSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const original = process.cwd();
const scratch = await mkdtemp(path.join(os.tmpdir(), "spaceship-browser-"));
const root = path.join(scratch, "website");
const rootURL = pathToFileURL(`${root}/`);

async function snapshot() {
	await mkdir(root);
	const files = execFileSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
		{
			cwd: original,
			encoding: "utf8",
		},
	)
		.split("\0")
		.filter(Boolean);
	for (const file of files) {
		if (!existsSync(path.join(original, file))) continue;
		await mkdir(path.dirname(path.join(root, file)), { recursive: true });
		await cp(path.join(original, file), path.join(root, file), {
			dereference: true,
			mode: constants.COPYFILE_FICLONE,
		});
	}
	// Snapshot already-synced writing and media without syncing or changing the live project.
	for (const file of ["src/content", "public", "src/data/photos.json", ".content-state.json"]) {
		if (!existsSync(path.join(original, file))) continue;
		await cp(path.join(original, file), path.join(root, file), {
			recursive: true,
			dereference: true,
			mode: constants.COPYFILE_FICLONE,
		});
	}
	// Astro and Vite write into node_modules; a shared dependency symlink would leak caches.
	const modules = path.join(original, "node_modules");
	await cp(modules, path.join(root, "node_modules"), {
		recursive: true,
		verbatimSymlinks: true,
		mode: constants.COPYFILE_FICLONE,
		filter: (source) =>
			![".astro", ".vite", ".vite-temp", ".cache"].includes(
				path.relative(modules, source).split(path.sep)[0],
			),
	});
	assert.notEqual(await realpath(root), await realpath(original));
	assert.equal((await lstat(path.join(root, "node_modules"))).isSymbolicLink(), false);
	assert.notEqual(await realpath(path.join(root, "node_modules")), await realpath(modules));
	assert.equal(existsSync(path.join(root, ".astro")), false);
	assert.equal(existsSync(path.join(root, "node_modules/.astro")), false);
}

async function addFixtures() {
	const directory = new URL("src/content/blog/verification-reading/", rootURL);
	const media = new URL("public/__test__/", rootURL);
	const seriesFile = new URL("src/content/site/series.json", rootURL);
	const originalSeries = await readFile(seriesFile, "utf8");
	const noteFixtures = Array.from(
		{ length: 4 },
		(_, i) => new URL(`src/content/post/verification-note-${i}/`, rootURL),
	);
	async function addFixture(kind, id, content) {
		const folder = new URL(`src/content/${kind}/${id}/`, rootURL);
		await rm(folder, { recursive: true, force: true });
		await mkdir(folder, { recursive: true });
		await writeFile(new URL("index.md", folder), content);
	}
	for (const [i, folder] of noteFixtures.entries()) {
		await rm(folder, { recursive: true, force: true });
		await mkdir(folder, { recursive: true });
		const noteText = `布局验证短记 ${i}。${"这是一段用于检验四行摘要的长文字，完整内容仍然可以打开阅读。".repeat(8)}`;
		// A far-future date keeps the three homepage fixtures ahead of changing personal content.
		// These dates exist only inside this disposable test project.
		const year = i === 0 ? "2099" : "2026";
		await writeFile(
			new URL(i === 0 ? "index.mdx" : "index.md", folder),
			`---\ntags: [随记]\ndescription: "//"\npublishDate: "${year}-09-${String(10 - i).padStart(2, "0")}T12:00:00+10:00"\n---\n\n${i === 0 ? `export const message = ${JSON.stringify(noteText)};\n\n<p>{message}</p>` : noteText}\n\n![舷窗](/defaults/portrait.svg)\n\n<img src="/defaults/icon.svg" alt="标记" />\n`,
		);
	}
	await rm(directory, { recursive: true, force: true });
	await mkdir(directory, { recursive: true });
	const fixture = await readFile(
		new URL("tests/fixtures/verification-reading.md", rootURL),
		"utf8",
	);
	// Only the isolated test build receives this published fixture. The source remains a draft.
	await writeFile(
		new URL("index.md", directory),
		fixture.replace("draft: true", "draft: false") +
			"\n\n[![链接图](/defaults/icon.svg)](/zh/blogs/)\n",
	);
	await addFixture(
		"blog",
		"verification-reading-next",
		"---\ntitle: 阅读验证的下一篇\ndescription: 下一篇内容的测试摘要。\npublishDate: 2026-01-02\nseries: verification\nmusic: false\n---\n\n这是同系列的后续内容。\n",
	);
	await addFixture(
		"blog",
		"verification-reading-draft",
		"---\ntitle: 不应显示的草稿\ndescription: 未发布\npublishDate: 2026-01-03\nseries: verification\ndraft: true\n---\n\n这篇仍然是草稿。\n",
	);
	for (const kind of ["music", "book", "movie"]) {
		await addFixture(
			"post",
			`verification-${kind}`,
			`---\npublishDate: "2026-08-10T12:00:00+10:00"\nrecommendation:\n  kind: ${kind}\n  title: "${kind === "music" ? "测试歌曲" : kind === "book" ? "测试书籍" : "测试电影"}"\n  url: ${kind === "music" ? "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" : "https://zh.wikipedia.org/wiki/"}\n  creator: 测试创作者\n  cover: /defaults/portrait.svg\n${kind === "music" ? "  audio: /__test__/silence.wav\n" : ""}---\n\n这是一条仅在测试构建中出现的推荐理由。\n`,
		);
	}
	await addFixture(
		"post",
		"verification-spotify-link",
		`---\ntitle: 不应重复显示的分享标题\npublishDate: "2099-09-09T12:01:00+10:00"\nrecommendation:\n  kind: music\n  title: 只有链接的音乐推荐\n  url: https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC\n  cover: /defaults/icon.svg\n---\n\n在 Spotify 收听，不加载第三方播放器。\n`,
	);
	await addFixture(
		"post",
		"verification-excerpt",
		`---\ntitle: 不应重复显示的摘抄标题\ntags: [摘抄]\npublishDate: "2099-09-09T13:00:00+10:00"\n---\n\n这段引言保留普通正文的排版。\n\n> 把想留下的**句子**放在这里，让引用和自己的感想清楚分开。\n\n—— 排版验证用的原创示例。\n\n这是引用之后的感想，继续使用普通正文的字体。\n`,
	);
	// Give the copied personal example a local cover so browser builds never need Spotify.
	const exampleShare = new URL("src/content/post/example-share/index.md", rootURL);
	if (existsSync(exampleShare)) {
		const content = await readFile(exampleShare, "utf8");
		await writeFile(
			exampleShare,
			/^ {2}cover:.*$/m.test(content)
				? content.replace(/^ {2}cover:.*$/m, "  cover: /defaults/portrait.svg")
				: content.replace(
						"recommendation:\n",
						"recommendation:\n  cover: /defaults/portrait.svg\n",
					),
		);
	}
	for (let i = 0; i < 22; i++) {
		await addFixture(
			"post",
			`verification-archive-${i}`,
			`---\ntags: [随记]\npublishDate: "2026-02-${String(i + 1).padStart(2, "0")}T12:00:00+10:00"\n---\n\n归档定位验证 ${i}。\n`,
		);
	}
	await mkdir(media, { recursive: true });
	const wav = Buffer.alloc(16044);
	wav.write("RIFF");
	wav.writeUInt32LE(16036, 4);
	wav.write("WAVEfmt ", 8);
	wav.writeUInt32LE(16, 16);
	wav.writeUInt16LE(1, 20);
	wav.writeUInt16LE(1, 22);
	wav.writeUInt32LE(8000, 24);
	wav.writeUInt32LE(16000, 28);
	wav.writeUInt16LE(2, 32);
	wav.writeUInt16LE(16, 34);
	wav.write("data", 36);
	wav.writeUInt32LE(16000, 40);
	await writeFile(new URL("silence.wav", media), wav);
	// The test catalog and all fixtures remain in the snapshot for its entire lifetime.
	const catalog = JSON.parse(originalSeries);
	const entries = Array.isArray(catalog) ? catalog : catalog.order;
	entries.push({
		id: "verification",
		zh: "测试系列",
		en: "Verification series",
		aliases: ["旧测试系列"],
		legacyTags: ["old verification", "verification series"],
		description: { zh: "测试系列介绍", en: "Test series introduction" },
	});
	await writeFile(seriesFile, JSON.stringify(catalog));
}

let child;
let stopping = false;
const stop = (signal) => {
	stopping = true;
	child?.kill(signal);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
function run(args) {
	if (stopping) throw new Error("Test server stopped");
	return new Promise((resolve, reject) => {
		child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
		child.once("error", reject);
		child.once("close", (code, signal) => {
			child = undefined;
			if (code === 0 || stopping) resolve();
			else reject(new Error(`Test server command failed (${signal || code})`));
		});
	});
}
try {
	await snapshot();
	if (!stopping) {
		await addFixtures();
		console.log(`Browser test project: ${root}`);
		if (process.argv.includes("--check-isolation")) {
			console.log("PASS: source snapshot, fixtures and writable dependency caches are isolated.");
		} else {
			await run(["node_modules/astro/bin/astro.mjs", "build", "--outDir", ".test-dist"]);
			await run(["node_modules/pagefind/lib/runner/bin.cjs", "--site", ".test-dist", "--silent"]);
			await run([
				"node_modules/astro/bin/astro.mjs",
				"preview",
				"--outDir",
				".test-dist",
				"--host",
				"127.0.0.1",
				"--port",
				"4323",
			]);
		}
	}
} catch (error) {
	if (!stopping) throw error;
} finally {
	if (child?.pid) {
		await new Promise((resolve) => {
			child.once("close", resolve);
			child.kill("SIGTERM");
		});
	}
	await rm(scratch, { recursive: true, force: true });
}
