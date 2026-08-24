#!/usr/bin/env node
/**
 * Fill src/content/{post,note} from a private source when those folders
 * have no markdown (e.g. Vercel git clone of the public repo).
 *
 * Local writing wins: if .md files already exist, this is a no-op.
 *
 * CONTENT_DIR=/path/to/olivia-blog-content
 * CONTENT_REPO=git@github.com:Olivia295/olivia-blog-content.git
 * CONTENT_SSH_KEY=base64 of a read-only deploy key (or raw PEM)
 * CONTENT_REPO_TOKEN=https PAT (optional alternative to SSH)
 */
import { execSync } from "node:child_process";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const postDir = path.join(root, "src/content/post");
const noteDir = path.join(root, "src/content/note");
const photosJson = path.join(root, "src/data/photos.json");

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

async function cloneRepo(repo, dest) {
	const env = { ...process.env };
	const sshKey = process.env.CONTENT_SSH_KEY;
	const token = process.env.CONTENT_REPO_TOKEN;
	if (sshKey) {
		const keyPath = path.join(os.tmpdir(), "olivia-content-deploy-key");
		let pem = sshKey.includes("BEGIN") ? sshKey.replace(/\\n/g, "\n") : Buffer.from(sshKey, "base64").toString("utf8");
		if (!pem.endsWith("\n")) pem += "\n";
		await writeFile(keyPath, pem, { mode: 0o600 });
		env.GIT_SSH_COMMAND = `ssh -i "${keyPath}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
	}
	let url = repo;
	if (token && url.startsWith("https://")) {
		url = url.replace(/^https:\/\//, `https://x-access-token:${token}@`);
	}
	execSync(`git clone --depth 1 "${url}" "${dest}"`, { env, stdio: "inherit" });
}

const hasLocalWriting = (await hasMarkdown(postDir)) || (await hasMarkdown(noteDir));
const hasLocalGallery = existsSync(photosJson);
const contentDir = process.env.CONTENT_DIR;
const repo = process.env.CONTENT_REPO;

if (hasLocalWriting && hasLocalGallery && !contentDir && !repo) {
	console.log("sync-content: using local writing and gallery");
	process.exit(0);
}

let source = contentDir ?? "";

if (!source && repo && (!hasLocalWriting || !hasLocalGallery)) {
	const cache = path.join(root, ".content-src", "repo");
	if (existsSync(path.join(cache, ".git"))) {
		execSync("git pull --ff-only", { cwd: cache, stdio: "inherit" });
	} else {
		await cloneRepo(repo, cache);
	}
	source = cache;
}

if (!source) {
	console.log(
		"sync-content: no local content and no CONTENT_DIR/CONTENT_REPO — building with empty writing/gallery",
	);
	process.exit(0);
}

if (!hasLocalWriting) {
	await copyIfPresent(path.join(source, "post"), postDir);
	await copyIfPresent(path.join(source, "note"), noteDir);
	await copyIfPresent(path.join(source, "notes-images"), path.join(root, "public/notes"));
}

if (!hasLocalGallery) {
	const remotePhotos = path.join(source, "gallery/photos.json");
	if (existsSync(remotePhotos)) {
		await mkdir(path.dirname(photosJson), { recursive: true });
		await cp(remotePhotos, photosJson);
	}
	await copyIfPresent(path.join(source, "gallery/images"), path.join(root, "public/gallery"));
}

console.log("sync-content: copied private content");
