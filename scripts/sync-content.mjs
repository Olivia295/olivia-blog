#!/usr/bin/env node
/**
 * Fill src/content/{post,note} from a private source when those folders
 * have no markdown (e.g. Vercel git clone of the public repo).
 *
 * Local writing wins: if .md files already exist, this is a no-op.
 *
 * CONTENT_DIR=/path/to/olivia-blog-content
 * CONTENT_REPO=git URL of the private content repo
 * CONTENT_SSH_KEY=base64 of a read-only deploy key (or raw PEM)
 * CONTENT_REPO_TOKEN=https PAT (optional alternative to SSH)
 */
import { execSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

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

function skipJunk(src) {
	const base = path.basename(src);
	return base !== ".DS_Store" && base !== ".git" && !base.startsWith("._");
}

async function replaceDir(from, to) {
	if (!existsSync(from)) return false;
	await rm(to, { recursive: true, force: true });
	await mkdir(path.dirname(to), { recursive: true });
	await cp(from, to, { recursive: true, filter: skipJunk });
	return true;
}

/**
 * Site chrome (logo, home-hero, tab icon) lives in content/site.
 * Defaults stay in public/; this only writes gitignored overlays.
 */
async function applySiteChrome(source) {
	const localSiteDir = path.join(root, "src/content/site");
	const publicSiteDir = path.join(root, "public/site");
	const remoteSite = source ? path.join(source, "site") : "";

	if (remoteSite && existsSync(remoteSite)) {
		await replaceDir(remoteSite, localSiteDir);
	}

	if (!existsSync(localSiteDir)) {
		await rm(publicSiteDir, { recursive: true, force: true });
		return false;
	}

	await replaceDir(localSiteDir, publicSiteDir);
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
const AUDIO_EXT = new Set([".mp3", ".m4a", ".ogg", ".wav", ".flac"]);

function isAbsUrl(src) {
	return /^(https?:)?\/\//i.test(src) || src.startsWith("/") || src.startsWith("data:");
}

function rewriteRelativeMedia(markdown, publicPrefix) {
	return markdown.replace(
		/((?:src\s*=\s*|\]\()["']?)([^"')\s>]+)(["']?)/g,
		(full, left, src, right) => {
			if (isAbsUrl(src) || src.startsWith("#") || src.startsWith("mailto:")) return full;
			const clean = src.replace(/^\.\//, "");
			if (!IMAGE_EXT.has(path.extname(clean).toLowerCase()) && !AUDIO_EXT.has(path.extname(clean).toLowerCase())) {
				return full;
			}
			return `${left}${publicPrefix}/${path.basename(clean)}${right}`;
		},
	);
}

function injectMusicFrontmatter(markdown, src, title) {
	if (/^---[\s\S]*?^music:/m.test(markdown)) return markdown;
	if (!markdown.startsWith("---")) {
		return `---\nmusic:\n  src: ${src}\n  title: ${JSON.stringify(title)}\n---\n\n${markdown}`;
	}
	return markdown.replace(/^---\n/, `---\nmusic:\n  src: ${src}\n  title: ${JSON.stringify(title)}\n`);
}

async function enhanceEntryFolders(contentRoot, publicKind, { withAudio = false } = {}) {
	if (!existsSync(contentRoot)) return;
	const publicRoot = path.join(root, "public/media", publicKind);
	for (const entry of await readdir(contentRoot, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
		const folder = path.join(contentRoot, entry.name);
		const files = await readdir(folder, { withFileTypes: true });
		const mdFiles = files.filter((f) => f.isFile() && /\.(md|mdx)$/i.test(f.name));
		if (!mdFiles.length) continue;
		const slug = entry.name;
		const publicPrefix = `/media/${publicKind}/${slug}`;
		const destPublic = path.join(publicRoot, slug);
		await mkdir(destPublic, { recursive: true });
		const mediaFiles = files.filter(
			(f) =>
				f.isFile() &&
				(IMAGE_EXT.has(path.extname(f.name).toLowerCase()) ||
					AUDIO_EXT.has(path.extname(f.name).toLowerCase())),
		);
		for (const file of mediaFiles) {
			await cp(path.join(folder, file.name), path.join(destPublic, file.name));
		}
		const audio = withAudio
			? mediaFiles.find((f) => AUDIO_EXT.has(path.extname(f.name).toLowerCase()))
			: undefined;
		for (const md of mdFiles) {
			const mdPath = path.join(folder, md.name);
			let text = await readFile(mdPath, "utf8");
			text = rewriteRelativeMedia(text, publicPrefix);
			if (audio) {
				const title = path.basename(audio.name, path.extname(audio.name));
				text = injectMusicFrontmatter(text, `${publicPrefix}/${audio.name}`, title);
			}
			await writeFile(mdPath, text);
		}
	}
}

/** Display pixel size after EXIF orientation (iPhone portraits are often tagged, not rotated). */
async function displaySize(file) {
	try {
		const meta = await sharp(file).metadata();
		if (!meta.width || !meta.height) return {};
		const orientation = meta.orientation ?? 1;
		const swapped = orientation >= 5 && orientation <= 8;
		return {
			width: swapped ? meta.height : meta.width,
			height: swapped ? meta.width : meta.height,
		};
	} catch {
		return {};
	}
}

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
		const files = (await readdir(folder))
			.filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
			.sort((a, b) => a.localeCompare(b, "en"));
		const photos = [];
		for (const name of files) {
			const stem = path.basename(name, path.extname(name));
			const size = await displaySize(path.join(folder, name));
			photos.push({
				slug: stem,
				src: `/media/gallery/${slug}/${name}`,
				alt: "",
				...size,
			});
		}
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
	const overlaid = await applySiteChrome("");
	console.log(
		overlaid
			? "sync-content: no content source — applied local site chrome from src/content/site"
			: "sync-content: no content source — leaving local files as they are",
	);
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
await enhanceEntryFolders(blogDir, "blogs", { withAudio: true });
await enhanceEntryFolders(postDir, "posts", { withAudio: false });
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

await applySiteChrome(source);

console.log("sync-content: copied private content from", source);
