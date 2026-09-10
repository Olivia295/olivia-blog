import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

const directory = new URL("../src/content/blog/verification-reading/", import.meta.url);
const media = new URL("../public/__test__/", import.meta.url);
const noteFixtures = Array.from(
	{ length: 4 },
	(_, i) => new URL(`../src/content/post/verification-note-${i}/`, import.meta.url),
);
for (const [i, folder] of noteFixtures.entries()) {
	await mkdir(folder, { recursive: true });
	await writeFile(
		new URL("index.md", folder),
		`---\ntags: [随记]\npublishDate: "2026-09-${String(10 - i).padStart(2, "0")}T12:00:00+10:00"\n---\n\n布局验证短记 ${i}。${"这是一段用于检验四行摘要的长文字，完整内容仍然可以打开阅读。".repeat(8)}\n\n![舷窗](/defaults/portrait.svg)\n\n<img src="/defaults/icon.svg" alt="标记" />\n`,
	);
}
await mkdir(directory, { recursive: true });
const fixture = await readFile(
	new URL("../tests/fixtures/verification-reading.md", import.meta.url),
	"utf8",
);
// Only the isolated test build receives this published fixture. The source remains a draft.
await writeFile(new URL("index.md", directory), fixture.replace("draft: true", "draft: false"));
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
let child;
let stopping = false;
async function cleanup(signal) {
	if (stopping) return;
	stopping = true;
	child?.kill(signal);
	await rm(directory, { recursive: true, force: true });
	await rm(media, { recursive: true, force: true });
	for (const folder of noteFixtures) await rm(folder, { recursive: true, force: true });
}
process.on("SIGINT", () => void cleanup("SIGINT"));
process.on("SIGTERM", () => void cleanup("SIGTERM"));
function run(args) {
	return new Promise((resolve, reject) => {
		child = spawn("node", args, { stdio: "inherit" });
		child.on("exit", (code) =>
			code === 0 ? resolve() : reject(new Error(`Test server command failed (${code})`)),
		);
	});
}
try {
	await run(["node_modules/astro/bin/astro.mjs", "build", "--outDir", ".test-dist"]);
	await run(["node_modules/pagefind/lib/runner/bin.cjs", "--site", ".test-dist", "--silent"]);
	await rm(directory, { recursive: true, force: true });
	await rm(media, { recursive: true, force: true });
	for (const folder of noteFixtures) await rm(folder, { recursive: true, force: true });
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
} finally {
	await cleanup("SIGTERM");
}
