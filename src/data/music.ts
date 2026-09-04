import musicManifest from "./music.json";
import { resolveMediaUrl } from "@/utils/media";

export type Song = {
	id?: string | undefined;
	artist: string;
	title: string;
	src: string;
};

type MusicRef = {
	id?: string | undefined;
	src?: string | undefined;
	title?: string | undefined;
	artist?: string | undefined;
};

/** Frontmatter `music` shapes after zod parse. */
export type PostMusicConfig = boolean | MusicRef | MusicRef[];

export function getSongs(): Song[] {
	const songs = (musicManifest.songs ?? []) as Array<{
		id?: string;
		artist?: string;
		title?: string;
		src: string;
	}>;
	return songs.map((song) => ({
		id: song.id,
		artist: song.artist ?? "Unknown Artist",
		title: song.title ?? "Unknown",
		src: resolveMediaUrl(song.src),
	}));
}

export function getSongById(id: string): Song | undefined {
	return getSongs().find((song) => song.id === id);
}

/**
 * Resolve post frontmatter `music` into a playable list.
 * - false / undefined → none
 * - true → full catalog
 * - { id } → one track from music.json
 * - { src, title?, artist? } → one-off external track
 * - array → several of the above
 */
export function resolvePostMusic(music: PostMusicConfig | undefined): Song[] | null {
	if (music === false || music == null) return null;
	if (music === true) return getSongs();

	const refs = Array.isArray(music) ? music : [music];
	const songs: Song[] = [];

	for (const ref of refs) {
		if (ref.id) {
			const found = getSongById(ref.id);
			if (!found) {
				throw new Error(
					`[music] Unknown song id "${ref.id}". Add it to src/data/music.json first.`,
				);
			}
			songs.push({
				...found,
				// allow override display fields
				title: ref.title ?? found.title,
				artist: ref.artist ?? found.artist,
				src: ref.src ? resolveMediaUrl(ref.src) : found.src,
			});
			continue;
		}

		if (ref.src) {
			songs.push({
				title: ref.title ?? "Unknown",
				artist: ref.artist ?? "Unknown Artist",
				src: resolveMediaUrl(ref.src),
			});
			continue;
		}

		throw new Error("[music] Each track needs either `id` (catalog) or `src` (URL).");
	}

	return songs.length > 0 ? songs : null;
}
