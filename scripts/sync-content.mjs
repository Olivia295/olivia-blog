#!/usr/bin/env node
/**
 * Fill src/content/{post,note} from a private source when the folders are empty.
 *
 * Local writing: do nothing (markdown is already in src/content).
 * Backup folder: CONTENT_DIR=/path/to/olivia-blog-content
 * Private repo:  CONTENT_REPO=https://github.com/you/olivia-blog-content.git
 *                CONTENT_REPO_TOKEN=...
 */
import { execSync } from "node:child_process";
import { cp, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const postDir = path.join(root, "src/content/post");
const noteDir = path.join(root, "src/content/note");

async function hasMarkdown(dir) {
	if (!existsSync(dir)) return false;
	const stack = [dir];
	while (stack.length) {
		const current = stack.pop();
		if (!current) continue;
		for (const entry of await readdir(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name) && entry.name !== "README.md") {
				return true;
			}
			if (entry.isDirectory()) stack.push(full);
		}
	}
	return false;
}

async function copyIfPresent(from, to) {
	if (!existsSync(from)) return false;
	await mkdir(to, { recursive: true });
	await cp(from, to, { recursive: true });
	return true;
}

const hasLocal = (await hasMarkdown(postDir)) || (await hasMarkdown(noteDir));
const contentDir = process.env.CONTENT_DIR;
const repo = process.env.CONTENT_REPO;
const token = process.env.CONTENT_REPO_TOKEN;

if (hasLocal && !contentDir && !repo) {
	console.log("sync-content: using local markdown in src/content");
	process.exit(0);
}

let source = contentDir ?? "";

if (repo) {
	const cache = path.join(root, ".content-src");
	const authUrl = token
		? repo.replace(/^https:\/\//, `https://x-access-token:${token}@`)
		: repo;
	if (existsSync(path.join(cache, ".git"))) {
		execSync("git pull --ff-only", { cwd: cache, stdio: "inherit" });
	} else {
		execSync(`git clone --depth 1 "${authUrl}" "${cache}"`, { stdio: "inherit" });
	}
	source = cache;
}

if (!source) {
	console.log(
		"sync-content: no local markdown and no CONTENT_DIR/CONTENT_REPO — building with empty posts/notes",
	);
	process.exit(0);
}

await copyIfPresent(path.join(source, "post"), postDir);
await copyIfPresent(path.join(source, "note"), noteDir);
const images = path.join(source, "notes-images");
if (existsSync(images)) {
	await copyIfPresent(images, path.join(root, "public/notes"));
}
console.log(`sync-content: copied from ${contentDir || "CONTENT_REPO"}`);
