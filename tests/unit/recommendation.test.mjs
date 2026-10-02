import assert from "node:assert/strict";
import { test } from "node:test";
import { feedContent } from "../../src/data/feed-content.ts";
import {
	isSpotifyRecommendation,
	recommendationCover,
	recommendationLinkLabel,
	recommendationMediaUrl,
	recommendationSchema,
} from "../../src/data/recommendation.ts";

const music = { kind: "music", title: "A song", url: "https://open.spotify.com/track/example" };

test("one recommendation accepts only safe links and media, with optional music audio", () => {
	assert.deepEqual(recommendationSchema.parse({ ...music, title: "  A song  " }), music);
	assert.equal(
		recommendationSchema.safeParse({ ...music, cover: "./cover.webp", audio: "/media/a.mp3" })
			.success,
		true,
	);
	for (const url of [
		"javascript:alert(1)",
		"data:text/html,test",
		"//example.org/",
		"https://u:p@example.org/",
		"https://exa\nmple.org/",
	]) {
		assert.equal(recommendationSchema.safeParse({ ...music, url }).success, false, url);
	}
	for (const cover of [
		"//example.org/a.jpg",
		"javascript:alert(1)",
		"../secret.jpg",
		"a/%2e%2e/secret.jpg",
		"a%5c.jpg",
	]) {
		assert.equal(recommendationSchema.safeParse({ ...music, cover }).success, false, cover);
	}
	assert.equal(
		recommendationSchema.safeParse({ ...music, kind: "book", audio: "/a.mp3" }).success,
		false,
	);
	assert.equal(recommendationSchema.safeParse({ ...music, title: " " }).success, false);
	assert.equal(recommendationSchema.safeParse([music, music]).success, false);
});

test("media resolves against the same flat or nested directory as content sync", () => {
	assert.equal(recommendationMediaUrl("./cover.webp", "note"), "/post/note/cover.webp");
	assert.equal(recommendationMediaUrl("./cover.webp", "note #1"), "/post/note%20%231/cover.webp");
	assert.equal(
		recommendationMediaUrl("./cover.webp", "note", "src/content/post/note.md"),
		"/post/cover.webp",
	);
	assert.equal(
		recommendationMediaUrl("./cover.webp", "note", "/site/src/content/post/2026/note/index.md"),
		"/post/2026/note/cover.webp",
	);
	assert.equal(recommendationMediaUrl("/media/cover.webp", "note"), "/media/cover.webp");
	assert.equal(
		recommendationMediaUrl("https://example.org/cover.webp", "note"),
		"https://example.org/cover.webp",
	);
});

test("music labels identify Spotify without mistaking lookalike domains", () => {
	assert.equal(isSpotifyRecommendation(music), true);
	assert.equal(isSpotifyRecommendation({ ...music, url: "https://spotify.link/example" }), true);
	assert.equal(
		isSpotifyRecommendation({ ...music, url: "https://open.spotify.com.example.org/" }),
		false,
	);
	assert.equal(isSpotifyRecommendation({ ...music, kind: "book" }), false);
	assert.equal(recommendationLinkLabel(music, "zh"), "在 Spotify 收听");
	assert.equal(
		recommendationLinkLabel({ ...music, url: "https://spotify.link/example" }, "zh"),
		"在 Spotify 收听",
	);
	assert.equal(
		recommendationLinkLabel({ ...music, url: "https://open.spotify.com.example.org/" }, "en"),
		"Listen here",
	);
	assert.equal(recommendationLinkLabel({ ...music, kind: "book" }, "en"), "About this work");
});

const track = { ...music, url: "https://open.spotify.com/track/5NqGfELjcdvRIUuhgZJ34W" };
const thumbnail =
	"https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e023bc8c5a65f225815fa3844e1";
const metadata = { provider_name: "Spotify", thumbnail_url: thumbnail };

test("explicit covers and unsupported URLs never trigger automatic requests", async (t) => {
	const request = t.mock.method(globalThis, "fetch", async () => {
		assert.fail("An explicit cover or unsupported URL must not use the network");
	});
	assert.equal(
		await recommendationCover({ ...track, cover: "./my-cover.webp" }),
		"./my-cover.webp",
	);
	assert.equal(await recommendationCover({ ...track, kind: "book" }), undefined);
	assert.equal(await recommendationCover({ ...track, kind: "movie" }), undefined);
	for (const url of [
		"https://open.spotify.com/",
		"https://spotify.link/example",
		"https://open.spotify.com/artist/5NqGfELjcdvRIUuhgZJ34W",
		"https://open.spotify.com/playlist/5NqGfELjcdvRIUuhgZJ34W",
		"https://open.spotify.com/track/not-an-id",
		"https://open.spotify.com/track/5NqGfELjcdvRIUuhgZJ34W/extra",
		"https://open.spotify.com.example.org/track/5NqGfELjcdvRIUuhgZJ34W",
		"https://user@open.spotify.com/track/5NqGfELjcdvRIUuhgZJ34W",
		"https://open.spotify.com:444/track/5NqGfELjcdvRIUuhgZJ34W",
		"http://open.spotify.com/track/5NqGfELjcdvRIUuhgZJ34W",
		"javascript:alert(1)",
	])
		assert.equal(await recommendationCover({ ...track, url }), undefined, url);
	assert.equal(request.mock.callCount(), 0);
});

test("Spotify metadata requests normalize track URLs and deduplicate concurrent renders", async (t) => {
	const request = t.mock.method(globalThis, "fetch", async (input, options) => {
		const url = new URL(input);
		assert.equal(url.origin + url.pathname, "https://open.spotify.com/oembed");
		assert.equal(url.searchParams.get("url"), track.url);
		assert.equal(options.redirect, "error");
		assert.equal(options.headers.Accept, "application/json");
		assert.ok(options.signal instanceof AbortSignal);
		return Response.json({
			...metadata,
			html: '<iframe src="https://untrusted.example/"></iframe>',
		});
	});
	const results = await Promise.all([
		recommendationCover(track),
		recommendationCover({ ...track, url: `${track.url}?si=sharing-code#tracking` }),
		recommendationCover({ ...track, url: `${track.url.replace("/track/", "/intl-ja/track/")}/` }),
	]);
	assert.deepEqual(results, [thumbnail, thumbnail, thumbnail]);
	assert.equal(await recommendationCover(track), thumbnail);
	assert.equal(request.mock.callCount(), 1);
});

test("album covers accept the documented Spotify image CDN", async (t) => {
	const cover = "https://i.scdn.co/image/ab67616d00001e023bc8c5a65f225815fa3844e1";
	t.mock.method(globalThis, "fetch", async (input) => {
		assert.equal(
			new URL(input).searchParams.get("url"),
			"https://open.spotify.com/album/2JzVi6d4gLdVFemJKJSPJf",
		);
		return Response.json({ ...metadata, thumbnail_url: cover });
	});
	assert.equal(
		await recommendationCover({
			...track,
			url: "https://open.spotify.com/album/2JzVi6d4gLdVFemJKJSPJf",
		}),
		cover,
	);
});

test("missing or unsafe Spotify thumbnails gracefully fall back to text", async (t) => {
	const responses = [
		() => new Response("unavailable", { status: 503 }),
		() => new Response("invalid JSON"),
		() => Response.json(null),
		() => Response.json({ provider_name: "Other", thumbnail_url: thumbnail }),
		() => Response.json({ provider_name: "Spotify" }),
		...[
			"javascript:alert(1)",
			"https://attacker.example/image/cover",
			"https://i.scdn.co.attacker.example/image/cover",
			"https://user@i.scdn.co/image/cover",
			"http://i.scdn.co/image/cover",
			"https://i.scdn.co/not-an-image",
		].map((thumbnail_url) => () => Response.json({ ...metadata, thumbnail_url })),
	];
	let nextResponse = 0;
	const request = t.mock.method(globalThis, "fetch", async () => responses[nextResponse++]());
	for (const index of responses.keys()) {
		const item = {
			...track,
			url: `https://open.spotify.com/track/${String(index).padStart(22, "0")}`,
		};
		assert.equal(await recommendationCover(item), undefined);
		assert.equal(await recommendationCover(item), undefined);
		assert.equal(request.mock.callCount(), index + 1, "Failed responses are cached too");
	}
});

test("network errors and timeouts preserve the recommendation without retries", async (t) => {
	const errors = [new Error("Offline"), new DOMException("Timed out", "TimeoutError")];
	let nextError = 0;
	const request = t.mock.method(globalThis, "fetch", async (_input, options) => {
		assert.ok(options.signal instanceof AbortSignal);
		throw errors[nextError++];
	});
	for (const index of errors.keys()) {
		const item = {
			...track,
			url: `https://open.spotify.com/track/${String(100 + index).padStart(22, "0")}`,
		};
		assert.equal(await recommendationCover(item), undefined);
		assert.equal(await recommendationCover(item), undefined);
		assert.equal(request.mock.callCount(), index + 1);
	}
});

test("RSS reuses the resolved cover and emits an image plus a link without embed HTML", async (t) => {
	const item = { ...track, url: "https://open.spotify.com/track/1111111111111111111111" };
	const request = t.mock.method(globalThis, "fetch", async () =>
		Response.json({
			...metadata,
			html: '<iframe src="https://open.spotify.com/embed/track/1111111111111111111111"></iframe>',
		}),
	);
	assert.equal(await recommendationCover(item), thumbnail);
	const result = await feedContent("<p>A personal recommendation.</p>", {
		pageUrl: "https://example.org/zh/posts/#post-music",
		mediaUrl: "https://example.org/post/music/",
		lang: "en",
		recommendation: item,
	});
	assert.match(result.html, /<img\b/);
	assert.ok(result.html.includes(`src="${thumbnail}"`));
	assert.ok(result.html.includes(`href="${item.url}"`));
	assert.doesNotMatch(result.html, /<iframe|<script|<audio/);
	assert.equal(request.mock.callCount(), 1);
});
