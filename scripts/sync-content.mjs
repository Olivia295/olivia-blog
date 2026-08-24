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
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const blogDir = path.join(root, "src/content/blog");
const postDir = path.join(root, "src/content/post");
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

async function replaceDir(from, to) {
	if (!existsSync(from)) return false;
	await rm(to, { recursive: true, force: true });
	await mkdir(path.dirname(to), { recursive: true });
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

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

async function buildGalleryFromFolders(galleryRoot, photosOut, mediaOut) {
	if (!existsSync(galleryRoot)) return false;
	const albums = [];
	for (const entry of await readdir(galleryRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith(".") || entry.name === "images") continue;
		const folder = path.join(galleryRoot, entry.name);
		let meta = {};
		const metaFile = path.join(folder, "album.json");
		if (existsSync(metaFile)) {
			meta = JSON.parse(await readFile(metaFile, "utf8"));
		}
		const slug = String(meta.slug || entry.name);
		const title = String(meta.title || entry.name);
		const alts = meta.alts && typeof meta.alts === "object" ? meta.alts : {};
		const files = (await readdir(folder))
			.filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
			.sort((a, b) => a.localeCompare(b, "en"));
		const photos = files.map((name) => {
			const stem = path.basename(name, path.extname(name));
			return {
				slug: stem,
				src: `/media/gallery/${slug}/${name}`,
				alt: alts[stem] || alts[name] || stem,
			};
		});
		if (Array.isArray(meta.photos)) {
			for (const extra of meta.photos) {
				if (extra?.src) photos.push(extra);
			}
		}
		if (!photos.length) continue;
		const dest = path.join(mediaOut, slug);
		await mkdir(dest, { recursive: true });
		for (const name of files) {
			await cp(path.join(folder, name), path.join(dest, name));
		}
		albums.push({ slug, title, photos });
	}
	if (!albums.length) return false;
	await mkdir(path.dirname(photosOut), { recursive: true });
	await writeFile(photosOut, `${JSON.stringify({ albums }, null, "\t")}\n`);
	return true;
}

const sibling = path.resolve(root, "../olivia-blog-content");
const contentDir =
	process.env.CONTENT_DIR || (existsSync(path.join(sibling, ".git")) ? sibling : "");
const repo = process.env.CONTENT_REPO;
let source = contentDir;

if (!source && repo) {
	const cache = path.join(root, ".content-src", "repo");
	if (existsSync(path.join(cache, ".git"))) {
		execSync("git pull --ff-only", { cwd: cache, stdio: "inherit" });
	} else {
		await cloneRepo(repo, cache);
	}
	source = cache;
}

if (!source) {
	console.log("sync-content: no content source — leaving local files as they are");
	process.exit(0);
}

if (existsSync(path.join(source, "blog"))) {
	await replaceDir(path.join(source, "blog"), blogDir);
	await replaceDir(path.join(source, "post"), postDir);
} else {
	await replaceDir(path.join(source, "post"), blogDir);
	await replaceDir(path.join(source, "note"), postDir);
}
await mkdir(blogDir, { recursive: true });
await mkdir(postDir, { recursive: true });
await writeFile(path.join(blogDir, ".gitkeep"), "");
await writeFile(path.join(postDir, ".gitkeep"), "");
await copyIfPresent(path.join(source, "post/images"), path.join(root, "public/notes"));
await copyIfPresent(path.join(source, "notes-images"), path.join(root, "public/notes"));

const built = await buildGalleryFromFolders(
	path.join(source, "gallery"),
	photosJson,
	path.join(root, "public/media/gallery"),
);
if (!built) {
	const remotePhotos = path.join(source, "gallery/photos.json");
	if (existsSync(remotePhotos)) {
		await mkdir(path.dirname(photosJson), { recursive: true });
		await cp(remotePhotos, photosJson);
	}
	await copyIfPresent(path.join(source, "gallery/images"), path.join(root, "public/media/gallery"));
}

const siteDir = path.join(source, "site");
if (existsSync(path.join(siteDir, "logo.png"))) {
	await cp(path.join(siteDir, "logo.png"), path.join(root, "public/logo.png"));
}
if (existsSync(path.join(siteDir, "home-hero.jpg"))) {
	await cp(path.join(siteDir, "home-hero.jpg"), path.join(root, "public/home-hero.jpg"));
}

console.log("sync-content: copied private content from", source);
