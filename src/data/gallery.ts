import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isBarePreview } from "@/data/bare";
import { resolveMediaUrl } from "@/utils/media";

export type Photo = {
	slug: string;
	src: string;
	alt: string;
	width?: number;
	height?: number;
};

export type AlbumRow = {
	kind: "pair" | "wide" | "tile";
	photos: Photo[];
};

function photosHaveSizes(photos: Photo[]): boolean {
	return photos.length > 0 && photos.every((photo) => photo.width && photo.height);
}

function isPortrait(photo: Photo): boolean {
	return Boolean(photo.width && photo.height && photo.height > photo.width);
}

/** Two-up rows; mixed albums give landscapes a full row and pair portraits. */
export function packAlbumRows(photos: Photo[]): AlbumRow[] | null {
	if (!photosHaveSizes(photos)) return null;

	const mixed =
		photos.some((photo) => isPortrait(photo)) &&
		photos.some((photo) => !isPortrait(photo));

	if (!mixed) {
		const rows: AlbumRow[] = [];
		for (let i = 0; i < photos.length; i += 2) {
			const first = photos[i]!;
			const second = photos[i + 1];
			if (second) rows.push({ kind: "pair", photos: [first, second] });
			else rows.push({ kind: "tile", photos: [first] });
		}
		return rows;
	}

	const rows: AlbumRow[] = [];
	let pending: Photo | undefined;

	for (const photo of photos) {
		if (!isPortrait(photo)) {
			if (pending) {
				rows.push({ kind: "tile", photos: [pending] });
				pending = undefined;
			}
			rows.push({ kind: "wide", photos: [photo] });
			continue;
		}
		if (pending) {
			rows.push({ kind: "pair", photos: [pending, photo] });
			pending = undefined;
		} else {
			pending = photo;
		}
	}

	if (pending) rows.push({ kind: "tile", photos: [pending] });
	return rows;
}

export type PhotoAlbum = {
	slug: string;
	title: string;
	photos: Photo[];
};

type PhotosFile = { albums: PhotoAlbum[] };

function loadPhotosManifest(): PhotosFile {
	const file = path.join(process.cwd(), "src/data/photos.json");
	if (!existsSync(file)) return { albums: [] };
	try {
		return JSON.parse(readFileSync(file, "utf8")) as PhotosFile;
	} catch {
		return { albums: [] };
	}
}

export function getPhotoAlbums(): PhotoAlbum[] {
	if (isBarePreview()) return [];
	return loadPhotosManifest().albums.map((album) => ({
		slug: album.slug,
		title: album.title,
		photos: album.photos.map((photo) => ({
			...photo,
			src: resolveMediaUrl(photo.src),
		})),
	}));
}

export function getPhotoAlbum(albumSlug: string): PhotoAlbum | undefined {
	return getPhotoAlbums().find((album) => album.slug === albumSlug);
}

export function getPhoto(
	albumSlug: string,
	photoSlug: string,
): { album: PhotoAlbum; photo: Photo; index: number } | undefined {
	const album = getPhotoAlbum(albumSlug);
	if (!album) return undefined;
	const index = album.photos.findIndex((p) => p.slug === photoSlug);
	if (index < 0) return undefined;
	return { album, photo: album.photos[index]!, index };
}

/** Build responsive srcset for known CDNs; falls back to single URL. */
export function buildPhotoSrcSet(
	src: string,
	widths: number[] = [400, 800, 1200, 1600],
): string | undefined {
	try {
		const url = new URL(src);
		if (url.hostname.includes("images.unsplash.com")) {
			return widths
				.map((w) => {
					const u = new URL(src);
					u.searchParams.set("w", String(w));
					u.searchParams.set("auto", "format");
					u.searchParams.set("fit", "crop");
					u.searchParams.set("q", "80");
					return `${u.href} ${w}w`;
				})
				.join(", ");
		}
	} catch {
		// not an absolute URL
	}
	return undefined;
}

export function photoThumbUrl(src: string, width = 600): string {
	try {
		const url = new URL(src);
		if (url.hostname.includes("images.unsplash.com")) {
			url.searchParams.set("w", String(width));
			url.searchParams.set("auto", "format");
			url.searchParams.set("fit", "crop");
			url.searchParams.set("q", "75");
			return url.href;
		}
	} catch {
		// keep original
	}
	return src;
}

export function photoFullUrl(src: string, width = 1600): string {
	return photoThumbUrl(src, width);
}
