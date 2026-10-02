import assert from "node:assert/strict";
import { test } from "node:test";
import rss from "@astrojs/rss";
import { XMLParser } from "fast-xml-parser";
import { contentMediaBase } from "../../src/data/content-render.ts";
import {
	escapeXml,
	feedContent,
	feedGuid,
	feedSummary,
	postFeedMetadata,
	publishedFeedEntries,
} from "../../src/data/feed-content.ts";
import { postSchema } from "../../src/data/post-schema.ts";

const options = {
	pageUrl: "https://example.com/zh/posts/entry/quiet-day/",
	mediaUrl: "https://example.com/post/quiet-day/",
	lang: "zh",
};

test("feed media follows flat and nested source directories instead of the entry slug", async () => {
	for (const [collection, filePath, expected] of [
		["post", "src/content/post/flat.mdx", "/post/"],
		["post", "/project/src/content/post/2026/nested/index.mdx", "/post/2026/nested/"],
		["blog", "src/content/blog/旅行/index.md", "/blog/%E6%97%85%E8%A1%8C/"],
	]) {
		const mediaUrl = contentMediaBase(
			{ collection, id: "custom-slug", filePath },
			"https://example.com/",
		);
		assert.equal(mediaUrl, `https://example.com${expected}`);
		const content = await feedContent(
			'<img src="./photo.jpg" alt="Picture"><audio src="./sound.mp3"></audio>',
			{ ...options, mediaUrl },
		);
		assert.ok(content.html.includes(`src="${mediaUrl}photo.jpg"`));
		assert.ok(content.html.includes(`href="${mediaUrl}sound.mp3"`));
	}
	assert.equal(
		contentMediaBase({ collection: "post", id: "fallback" }, "https://example.com/"),
		"https://example.com/post/fallback/",
	);
});

test("feeds keep complete rendered prose, tables and absolute images while removing active HTML", async () => {
	const result = await feedContent(
		'<h2 id="view">光 &amp; 影</h2><p>Some <strong>rendered MDX</strong> <a href="#view">section</a>.</p><div><img src="./photo.jpg" alt="海边" srcset="javascript:bad 1x" onerror="alert(1)"><table><tbody><tr><td>Full text</td></tr></tbody></table></div><script>SECRET_SCRIPT</script><style>SECRET_STYLE</style><svg><script>BAD_SVG</script></svg><form>FORM_TEXT</form><a href="jav&#x61;script:alert(1)">Safe words</a><span style="color:red" onclick="bad()">Still here</span><img src="data:text/html,bad" alt="Image unavailable">',
		options,
	);
	assert.match(result.html, /<h2 id="view">光 &#x26; 影<\/h2>/);
	assert.match(result.html, /<strong>rendered MDX<\/strong>/);
	assert.match(result.html, /src="https:\/\/example.com\/post\/quiet-day\/photo.jpg"/);
	assert.match(result.html, /href="https:\/\/example.com\/zh\/posts\/entry\/quiet-day\/#view"/);
	assert.match(result.html, /<td>Full text<\/td>/);
	assert.match(result.text, /Safe wordsStill hereImage unavailable/);
	assert.doesNotMatch(
		result.html,
		/SECRET_|BAD_SVG|FORM_TEXT|javascript|onclick|onerror|srcset|data:text|style=/,
	);
});

test("recommendations and embedded media become safe text, pictures and links", async () => {
	const result = await feedContent(
		'<p>Why I love it.</p><audio controls><source src="./listen.m4a" type="audio/mp4"></audio><iframe title="Watch trailer" src="https://example.org/embed/1"></iframe>',
		{
			...options,
			recommendation: {
				kind: "music",
				title: "My <Song>",
				creator: "A & B",
				url: "https://open.spotify.com/track/123",
				cover: "./cover.jpg",
				audio: "./song.mp3",
			},
		},
	);
	assert.match(result.text, /音乐 · My <Song> — A & B/);
	assert.match(result.html, /src="https:\/\/example.com\/post\/quiet-day\/cover.jpg"/);
	assert.match(result.html, /href="https:\/\/example.com\/post\/quiet-day\/song.mp3"/);
	assert.match(result.html, /href="https:\/\/example.com\/post\/quiet-day\/listen.m4a"/);
	assert.match(result.html, /href="https:\/\/example.org\/embed\/1"/);
	assert.match(result.html, /open.spotify.com\/track\/123/);
	assert.doesNotMatch(result.html, /<audio|<iframe|<source/);
	assert.match(result.html, /My &#x3C;Song>/);
});

test("RSS uses new standalone links without changing old subscription identities", async () => {
	for (const id of ["quiet-day", "note.v2", "心情"]) {
		const old = await rss({
			title: "Old",
			description: "Old",
			site: "https://example.com/",
			items: [{ title: "Note", link: `zh/posts/#post-${id}` }],
		});
		const parser = new XMLParser({ ignoreAttributes: false });
		const oldGuid = parser.parse(await old.text()).rss.channel.item.guid["#text"];
		assert.equal(feedGuid("post", id, "zh", "https://example.com/"), oldGuid);
	}
	const guid = feedGuid("post", "quiet-day", "zh", "https://example.com/");
	const response = await rss({
		title: "Notes",
		description: "Notes",
		site: "https://example.com/",
		items: [
			{
				title: "Note",
				link: options.pageUrl,
				content: "<p>Complete text</p>",
				customData: `<guid isPermaLink="false">${escapeXml(guid)}</guid>`,
			},
		],
	});
	const parsed = new XMLParser({ ignoreAttributes: false }).parse(await response.text());
	assert.equal(parsed.rss.channel.item.link, options.pageUrl);
	assert.equal(parsed.rss.channel.item.guid["#text"], guid);
	assert.equal(parsed.rss.channel.item.guid["@_isPermaLink"], "false");
	assert.equal(parsed.rss.channel.item["content:encoded"], "<p>Complete text</p>");
});

test("combined feed filters drafts and orders absolute timestamps with stable ties", () => {
	const entry = (id, collection, date, draft = false) => ({
		id,
		collection,
		data: { publishDate: new Date(date), draft },
	});
	const entries = [
		entry("z", "post", "2026-09-04T22:00:00+10:00"),
		entry("draft", "blog", "2026-09-06", true),
		entry("a", "blog", "2026-09-04T12:00:00Z"),
		entry("new", "post", "2026-09-05"),
	];
	assert.deepEqual(
		publishedFeedEntries(entries).map((item) => item.id),
		["new", "a", "z"],
	);
	assert.equal(entries[0].id, "z");
	assert.equal(feedSummary(" // ", "Original   writing."), "Original writing.");
	assert.equal(feedSummary("Written summary", "Body"), "Written summary");
	assert.equal(feedSummary(undefined, ""), "");
});

test("note RSS titles and summaries come from rendered writing, not removed metadata", async () => {
	const note = postSchema.parse({
		publishDate: "2026-09-26T12:00:00+10:00",
		title: "Legacy title must not appear",
		description: "Legacy summary must not appear",
	});
	for (const html of [
		"<h2>傍晚的光</h2><p>留下一件小事。</p>",
		"<blockquote><p>留下值得记住的句子。</p></blockquote><p>—— 来源</p>",
	]) {
		const content = await feedContent(html, options);
		const metadata = postFeedMetadata(content.text, note.publishDate, "zh");
		assert.equal(metadata.title, content.text);
		assert.equal(metadata.description, content.text);
		assert.doesNotMatch(metadata.title + metadata.description, /Legacy|<\/?/);
	}
	const recommendation = { kind: "book", title: "作品名称", url: "https://example.com/book" };
	const content = await feedContent("<p>我的推荐理由。</p>", { ...options, recommendation });
	const metadata = postFeedMetadata(content.text, note.publishDate, "zh", recommendation.title);
	assert.equal(metadata.title, "作品名称");
	assert.match(metadata.description, /我的推荐理由/);
});

test("note RSS labels remain useful for long Unicode writing and photos without text", () => {
	const date = new Date("2026-09-26T12:00:00+10:00");
	const long = postFeedMetadata(`  ${"光🌙".repeat(100)}\n `, date, "zh");
	assert.equal(long.title, `${"光🌙".repeat(25)}…`);
	assert.equal(long.description, `${"光🌙".repeat(90)}…`);
	assert.deepEqual(postFeedMetadata(" \n ", date, "zh"), {
		title: "随记 · 2026-09-26",
		description: "",
	});
	assert.deepEqual(postFeedMetadata("", date, "en"), {
		title: "Notes · 2026-09-26",
		description: "",
	});
});
