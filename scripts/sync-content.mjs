#!/usr/bin/env node
/** Authoritative, one-way import. Edit your content source, never the generated copies. */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const images = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"]);
const audio = new Set([".mp3", ".m4a", ".ogg", ".wav", ".flac"]);
const recognized = ["blog", "post", "tag", "site"];
const safeName = (value) =>
	typeof value === "string" &&
	value.length > 0 &&
	!/[\\/]/.test(value) &&
	[...value].every((char) => char.charCodeAt(0) >= 32) &&
	value !== "." &&
	value !== "..";
async function json(file, fallback = {}) {
	return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : fallback;
}
const skipJunk = (source) => {
	const name = path.basename(source);
	return name !== ".git" && name !== ".DS_Store" && !name.startsWith("._");
};
async function copyIfPresent(from, to) {
	await mkdir(to, { recursive: true });
	if (existsSync(from)) await cp(from, to, { recursive: true, filter: skipJunk });
}
export function rewriteRelativeMedia(markdown, prefix) {
	return markdown.replace(
		/((?:src\s*=\s*|\]\()["']?)([^"')\s>]+)(["']?)/g,
		(full, left, src, right) => {
			if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src)) return full;
			const clean = src.replace(/^\.\//, "");
			if (
				!images.has(path.extname(clean).toLowerCase()) &&
				!audio.has(path.extname(clean).toLowerCase())
			)
				return full;
			if (clean.split("/").includes(".."))
				throw new Error(`Media must stay inside its entry folder: ${src}`);
			return `${left}${prefix}/${clean}${right}`;
		},
	);
}
async function enhanceEntries(contentRoot, mediaRoot, kind) {
	async function walk(folder, relative = "") {
		const files = await readdir(folder, { withFileTypes: true });
		for (const entry of files) {
			if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
			const file = path.join(folder, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Content symlinks are not supported: ${file}`);
			if (entry.isDirectory()) {
				await walk(file, path.posix.join(relative, entry.name));
				continue;
			}
			if (/\.(md|mdx)$/i.test(entry.name)) {
				const prefix = `/${kind}${relative ? `/${relative}` : ""}`;
				let text = rewriteRelativeMedia(await readFile(file, "utf8"), prefix);
				if (kind === "blog" && !/^music:/m.test(text)) {
					const song = files.find(
						(f) => f.isFile() && audio.has(path.extname(f.name).toLowerCase()),
					);
					if (song)
						text = text.replace(
							/^---\r?\n/,
							`---\nmusic:\n  src: ${prefix}/${song.name}\n  title: ${JSON.stringify(path.parse(song.name).name)}\n`,
						);
				}
				await writeFile(file, text);
			} else if (
				images.has(path.extname(entry.name).toLowerCase()) ||
				audio.has(path.extname(entry.name).toLowerCase())
			) {
				const dest = path.join(mediaRoot, relative, entry.name);
				await mkdir(path.dirname(dest), { recursive: true });
				await cp(file, dest);
			}
		}
	}
	await walk(contentRoot);
}
async function displaySize(file) {
	const meta = await sharp(file).metadata();
	if (!meta.width || !meta.height) return {};
	const swapped = (meta.orientation ?? 1) >= 5 && (meta.orientation ?? 1) <= 8;
	return { width: swapped ? meta.height : meta.width, height: swapped ? meta.width : meta.height };
}
async function buildGallery(source, dest) {
	const galleryRoot = path.join(source, "gallery");
	if (!existsSync(galleryRoot)) return { albums: [] };
	const albums = [];
	const slugs = new Set();
	for (const entry of await readdir(galleryRoot, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "images") continue;
		const folder = path.join(galleryRoot, entry.name);
		const meta = await json(path.join(folder, "album.json"));
		const slug = String(meta.slug || entry.name);
		const title = String(meta.title || entry.name);
		if (!safeName(slug) || slugs.has(slug))
			throw new Error(`Album slug must be unique and contain no path separators: ${slug}`);
		slugs.add(slug);
		let updatedDate = meta.updatedDate || meta.date;
		if (!updatedDate && existsSync(path.join(source, ".git"))) {
			try {
				updatedDate = execFileSync(
					"git",
					["log", "-1", "--format=%cI", "--", `gallery/${entry.name}`],
					{ cwd: source, encoding: "utf8" },
				).trim();
			} catch {}
		}
		if (updatedDate && !Number.isFinite(Date.parse(updatedDate)))
			throw new Error(`Invalid album date in ${entry.name}`);
		const files = (await readdir(folder))
			.filter((name) => images.has(path.extname(name).toLowerCase()))
			.sort((a, b) => a.localeCompare(b, "en"));
		const photos = [];
		for (const name of files) {
			const size = await displaySize(path.join(folder, name));
			const previewName = `preview-${path.parse(name).name}.webp`;
			await mkdir(path.join(dest, slug), { recursive: true });
			await sharp(path.join(folder, name))
				.rotate()
				.resize({ width: 1000, withoutEnlargement: true })
				.webp({ quality: 80 })
				.toFile(path.join(dest, slug, previewName));
			photos.push({
				slug: path.parse(name).name,
				src: `/gallery/${encodeURIComponent(slug)}/${encodeURIComponent(name)}`,
				previewSrc: `/gallery/${encodeURIComponent(slug)}/${encodeURIComponent(previewName)}`,
				alt: meta.photoDetails?.[name]?.alt || `${title} · ${photos.length + 1}`,
				...size,
			});
			await mkdir(path.join(dest, slug), { recursive: true });
			await cp(path.join(folder, name), path.join(dest, slug, name));
		}
		for (const extra of meta.photos ?? []) {
			if (!extra.src) throw new Error(`A photo in ${entry.name} is missing src`);
			photos.push({ ...extra, alt: extra.alt || title });
		}
		if (photos.length)
			albums.push({
				slug,
				title,
				description: meta.description || "",
				updatedDate: updatedDate || undefined,
				order: Number.isFinite(Number(meta.order)) ? Number(meta.order) : 999,
				photos,
			});
	}
	if (albums.length)
		return {
			albums: albums.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh")),
		};
	const manifest = await json(path.join(galleryRoot, "photos.json"), { albums: [] });
	if (!Array.isArray(manifest.albums))
		throw new Error("gallery/photos.json must contain an albums array");
	for (const album of manifest.albums) {
		if (!safeName(album.slug) || !Array.isArray(album.photos))
			throw new Error("Invalid gallery manifest");
	}
	if (existsSync(path.join(galleryRoot, "images")))
		await cp(path.join(galleryRoot, "images"), path.join(dest, "images"), {
			recursive: true,
			filter: skipJunk,
		});
	return manifest;
}
export async function syncContent({ root, source, mode = "local", legacy = false }) {
	const resolved = await realpath(source).catch(() => {
		throw new Error(`Content directory does not exist: ${source}`);
	});
	const rootReal = await realpath(root);
	if (
		resolved === rootReal ||
		resolved.startsWith(path.join(rootReal, "src")) ||
		resolved.startsWith(path.join(rootReal, "public"))
	)
		throw new Error("The content source must be separate from generated website files");
	// Build and validate everything first, so malformed metadata cannot destroy the last good import.
	const stage = await mkdtemp(path.join(root, ".sync-stage-"));
	try {
		for (const kind of recognized) {
			const input = legacy ? (kind === "blog" ? "post" : kind === "post" ? "note" : kind) : kind;
			await copyIfPresent(path.join(resolved, input), path.join(stage, "content", kind));
		}
		for (const file of ["site.json", "about.json", "copy.json", "series.json"])
			await json(path.join(stage, "content/site", file));
		for (const kind of ["blog", "post", "tag"])
			await writeFile(path.join(stage, "content", kind, ".gitkeep"), "");
		for (const kind of ["blog", "post"])
			await enhanceEntries(
				path.join(stage, "content", kind),
				path.join(stage, "public", kind),
				kind,
			);
		const manifest = await buildGallery(resolved, path.join(stage, "public/gallery"));
		await copyIfPresent(path.join(stage, "content/site"), path.join(stage, "public/site"));
		for (const kind of recognized) {
			const to = path.join(root, "src/content", kind);
			await rm(to, { recursive: true, force: true });
			await mkdir(path.dirname(to), { recursive: true });
			await cp(path.join(stage, "content", kind), to, { recursive: true });
		}
		for (const kind of ["blog", "post", "gallery", "site", "notes", "media"]) {
			const to = path.join(root, "public", kind);
			await rm(to, { recursive: true, force: true });
			await copyIfPresent(path.join(stage, "public", kind), to);
		}
		await mkdir(path.join(root, "src/data"), { recursive: true });
		await writeFile(
			path.join(root, "src/data/photos.json"),
			JSON.stringify(manifest, null, "\t") + "\n",
		);
		await writeFile(
			path.join(root, ".content-state.json"),
			JSON.stringify({ mode, source: resolved }, null, "\t") + "\n",
		);
		// Astro 6 glob returns early for empty directories; invalidate its generated store after authoritative sync.
		await rm(path.join(root, ".astro/data-store.json"), { force: true });
		await rm(path.join(root, "node_modules/.astro/data-store.json"), { force: true });
	} finally {
		await rm(stage, { recursive: true, force: true });
	}
}
async function cloneRepo(repo, dest, env) {
	const temporary = await mkdtemp(path.join(os.tmpdir(), "spaceship-content-"));
	try {
		const gitEnv = { ...env };
		if (env.CONTENT_SSH_KEY) {
			const key = path.join(temporary, "key");
			let pem = env.CONTENT_SSH_KEY.includes("BEGIN")
				? env.CONTENT_SSH_KEY.replace(/\\n/g, "\n")
				: Buffer.from(env.CONTENT_SSH_KEY, "base64").toString("utf8");
			if (!pem.endsWith("\n")) pem += "\n";
			await writeFile(key, pem, { mode: 0o600 });
			gitEnv.GIT_SSH_COMMAND = `ssh -i '${key}' -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`;
		}
		if (env.CONTENT_REPO_TOKEN) {
			const helper = path.join(temporary, "askpass");
			await writeFile(
				helper,
				'#!/bin/sh\ncase "$1" in *Username*) printf "%s" "x-access-token" ;; *) printf "%s" "$CONTENT_REPO_TOKEN" ;; esac\n',
				{ mode: 0o700 },
			);
			gitEnv.GIT_ASKPASS = helper;
			gitEnv.GIT_TERMINAL_PROMPT = "0";
		}
		if (existsSync(path.join(dest, ".git")))
			execFileSync("git", ["pull", "--ff-only"], { cwd: dest, env: gitEnv, stdio: "pipe" });
		else
			execFileSync("git", ["clone", "--depth", "1", "--", repo, dest], {
				env: gitEnv,
				stdio: "pipe",
			});
	} catch {
		throw new Error(
			"Could not fetch the content repository. Check the URL and read-only credentials.",
		);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}
export async function runSync(root = process.cwd(), env = process.env) {
	const config = await json(path.join(root, "spaceship.config.json"));
	if (env.CONTENT_MODE && !["sample", "local"].includes(env.CONTENT_MODE))
		throw new Error("CONTENT_MODE must be sample or local");
	let source;
	let mode = "local";
	if (env.CONTENT_MODE === "sample") {
		source = path.join(root, "sample");
		mode = "sample";
	} else if (env.CONTENT_DIR) source = path.resolve(root, env.CONTENT_DIR);
	else if (config.content?.directory) source = path.resolve(root, config.content.directory);
	else if (env.CONTENT_REPO) {
		source = path.join(root, ".content-src/repo");
		await cloneRepo(env.CONTENT_REPO, source, env);
	} else if (
		config.content?.autoDiscoverSibling !== false &&
		existsSync(path.join(root, "../olivia-blog-content/.git"))
	)
		source = path.resolve(root, "../olivia-blog-content");
	else if (env.CONTENT_MODE === "local")
		throw new Error("Set CONTENT_DIR or content.directory before using local mode");
	else {
		source = path.join(root, "sample");
		mode = "sample";
	}
	await syncContent({
		root,
		source,
		mode,
		legacy: env.CONTENT_LEGACY === "1" || config.content?.legacy === true,
	});
	console.log(
		`sync-content: ${mode === "sample" ? "neutral sample" : "personal content"} imported; edit the source directory, not src/content`,
	);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		if (existsSync(".env")) process.loadEnvFile(".env");
		await runSync();
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
