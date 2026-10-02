import { z } from "astro/zod";

function isWebUrl(value: string) {
	if (
		!/^https?:\/\//i.test(value) ||
		/\\/.test(value) ||
		[...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
	)
		return false;
	try {
		const url = new URL(value);
		return /^https?:$/.test(url.protocol) && !url.username && !url.password;
	} catch {
		return false;
	}
}

function isMediaPath(value: string) {
	if (isWebUrl(value)) return true;
	try {
		const path = decodeURIComponent(value);
		return (
			!path.startsWith("//") &&
			!/[\\:#?\s]/.test(path) &&
			!path.split("/").includes("..") &&
			[...path].every((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
		);
	} catch {
		return false;
	}
}

const cleanText = z.string().trim().min(1);
const webUrl = cleanText.refine(isWebUrl, "Use an http:// or https:// link without credentials");
const mediaPath = cleanText.refine(
	isMediaPath,
	"Use an http(s) URL or a media path without parent directory traversal",
);

export const recommendationSchema = z
	.object({
		kind: z.enum(["music", "book", "movie"]),
		title: cleanText,
		url: webUrl,
		creator: cleanText.optional(),
		cover: mediaPath.optional(),
		audio: mediaPath.optional(),
	})
	.refine((value) => value.kind === "music" || !value.audio, {
		message: "Audio is only supported for a music recommendation",
		path: ["audio"],
	});

export type Recommendation = z.infer<typeof recommendationSchema>;

/** Only direct track/album URLs can unambiguously identify one music work. */
function spotifyWorkUrl(value: string): string | undefined {
	if (!isWebUrl(value)) return undefined;
	const url = new URL(value);
	if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || url.port)
		return undefined;
	const work = url.pathname.match(
		/^\/(?:intl-[a-z]{2}(?:-[A-Za-z]{2})?\/)?(track|album)\/([A-Za-z0-9]{22})\/?$/,
	);
	return work ? `https://open.spotify.com/${work[1]}/${work[2]}` : undefined;
}

function spotifyThumbnail(value: unknown): string | undefined {
	if (typeof value !== "string" || !isWebUrl(value)) return undefined;
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.port ||
		!(url.hostname === "i.scdn.co" || url.hostname.endsWith(".spotifycdn.com")) ||
		!/^\/image\/[A-Za-z0-9]+$/.test(url.pathname)
	)
		return undefined;
	return url.href;
}

async function fetchSpotifyCover(url: string): Promise<string | undefined> {
	try {
		const endpoint = new URL("https://open.spotify.com/oembed");
		endpoint.searchParams.set("url", url);
		const response = await fetch(endpoint, {
			headers: { Accept: "application/json" },
			redirect: "error",
			signal: AbortSignal.timeout(2500),
		});
		if (!response.ok) return undefined;
		const data: unknown = await response.json();
		if (
			!data ||
			typeof data !== "object" ||
			!("provider_name" in data) ||
			data.provider_name !== "Spotify"
		)
			return undefined;
		return "thumbnail_url" in data ? spotifyThumbnail(data.thumbnail_url) : undefined;
	} catch {
		// Missing metadata or a network failure must not block publishing or hide the link.
		return undefined;
	}
}

const spotifyCovers = new Map<string, Promise<string | undefined>>();

/** Server/build only: reuse successes and failures across pages; never render embed HTML. */
export async function recommendationCover(item: Recommendation): Promise<string | undefined> {
	if (item.cover) return item.cover;
	if (item.kind !== "music") return undefined;
	const url = spotifyWorkUrl(item.url);
	if (!url) return undefined;
	let result = spotifyCovers.get(url);
	if (!result) {
		result = fetchSpotifyCover(url);
		spotifyCovers.set(url, result);
	}
	return result;
}

/** Match the media directory copied by content sync, including flat and nested notes. */
export function recommendationMediaUrl(value: string, id: string, filePath?: string): string {
	if (/^(https?:\/\/|\/)/i.test(value)) return value;
	const source = filePath?.replace(/\\/g, "/").split("src/content/post/")[1];
	const directory = source ? source.slice(0, source.lastIndexOf("/") + 1) : `${id}/`;
	return new URL(
		value,
		`https://local.invalid/post/${directory.split("/").map(encodeURIComponent).join("/")}`,
	).pathname;
}

export function isSpotifyRecommendation(value: Recommendation): boolean {
	return (
		value.kind === "music" &&
		["open.spotify.com", "spotify.link"].includes(new URL(value.url).hostname)
	);
}

export function recommendationLinkLabel(value: Recommendation, lang: "zh" | "en"): string {
	if (value.kind !== "music") return lang === "en" ? "About this work" : "了解这部作品";
	return isSpotifyRecommendation(value)
		? lang === "en"
			? "Listen on Spotify"
			: "在 Spotify 收听"
		: lang === "en"
			? "Listen here"
			: "前往收听";
}
