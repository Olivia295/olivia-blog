import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isBarePreview } from "@/data/bare";
import { resolveMediaUrl } from "@/utils/media";

export type Photo = {
	slug: string;
	src: string;
	alt: string;
};

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
