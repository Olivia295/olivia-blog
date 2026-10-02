import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const skin of ["minimal", "spaceship"]) {
	for (const width of [320, 390, 768, 1440]) {
		test(`recommendations and stable note anchors in ${skin} at ${width}px`, async ({ page }) => {
			await page.addInitScript((value) => localStorage.setItem("blog-skin", value), skin);
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/zh/posts/?type=rec");
			await expect(page.locator('[id^="post-verification-"] .recommendation')).toHaveCount(4);
			for (const kind of ["music", "book", "movie"]) {
				const card = page.locator(`#post-verification-${kind}`);
				await expect(card.locator(`.recommendation--${kind}`)).toBeVisible();
				await expect(card.locator(".recommendation__link")).toHaveAttribute("target", "_blank");
				await expect(card.locator(".recommendation__cover img")).toHaveCSS("object-fit", "contain");
			}
			await expect(page.locator("iframe,audio[autoplay]")).toHaveCount(0);
			await expect(page.locator("#post-verification-spotify-link audio")).toHaveCount(0);
			await expect(
				page.locator("#post-verification-spotify-link .recommendation__link"),
			).toHaveAccessibleName("在 Spotify 收听");
			for (const scheme of ["light", "dark"] as const) {
				await page.emulateMedia({ colorScheme: scheme });
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true,
				);
				const result = await new AxeBuilder({ page })
					.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
					.analyze();
				expect(result.violations).toEqual([]);
			}
			await page.goto("/zh/posts/#post-verification-archive-0");
			const older = page.locator("#post-verification-archive-0");
			await expect(older).toBeInViewport();
			await expect(page.locator(".note-card__permalink")).toHaveCount(0);
			await expect(older.locator(".note-card__body")).toContainText("归档定位验证 0");
			await page.reload();
			await expect(older).toBeInViewport();
		});
	}
}

test("native recommendation audio plays and reports unavailable media", async ({ page }) => {
	await page.goto("/zh/posts/#post-verification-music");
	const card = page.locator("#post-verification-music");
	const audio = card.locator(".recommendation audio");
	await expect(audio).toHaveAttribute("preload", "none");
	await audio.evaluate((el: HTMLAudioElement) => el.play());
	await expect
		.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
		.toBeGreaterThan(0);
	await page.route("**/__test__/silence.wav", (route) => route.abort());
	await page.reload();
	await audio.evaluate((el: HTMLAudioElement) => {
		el.load();
	});
	await expect(card.locator(".recommendation__audio-error")).toBeVisible();
	await expect(card.locator(".recommendation__link")).toContainText("Spotify");
});

for (const lang of ["zh", "en"]) {
	test(`full RSS content, identity and ordering in ${lang}`, async ({ page, request }) => {
		const feeds: Record<
			string,
			Array<{
				title: string;
				link: string;
				guid: string;
				date: number;
				html: string;
				summary: string;
			}>
		> = {};
		await page.goto(`/${lang}/subscribe/`);
		for (const path of ["rss.xml", "posts/rss.xml", "feed.xml"]) {
			const response = await request.get(`/${lang}/${path}`);
			expect(response.ok()).toBe(true);
			feeds[path] = await page.evaluate(
				(xml) => {
					const doc = new DOMParser().parseFromString(xml, "application/xml");
					if (doc.querySelector("parsererror")) throw new Error("Invalid RSS XML");
					return Array.from(doc.querySelectorAll("item"), (item) => ({
						title: item.querySelector("title")?.textContent || "",
						link: item.querySelector("link")?.textContent || "",
						guid: item.querySelector("guid")?.textContent || "",
						date: Date.parse(item.querySelector("pubDate")?.textContent || ""),
						html:
							item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0]
								?.textContent || "",
						summary: item.querySelector("description")?.textContent || "",
					}));
				},
				await response.text(),
			);
		}
		const all = feeds["feed.xml"]!;
		expect(all.length).toBe(feeds["rss.xml"]!.length + feeds["posts/rss.xml"]!.length);
		expect(all.map((item) => item.date)).toEqual(
			all.map((item) => item.date).sort((a, b) => b - a),
		);
		expect(new Set(all.map((item) => item.guid)).size).toBe(all.length);
		expect(all.some((item) => item.link.includes("draft"))).toBe(false);
		expect(all.every((item) => item.html && item.summary !== "//")).toBe(true);
		const article = all.find((item) => item.link.endsWith("/verification-reading/"))!;
		expect(article.html).toContain("一点代码");
		expect(article.html).toMatch(/<img[^>]+src="https?:\/\/[^"]+\/defaults\/social-card.svg"/);
		expect(article.html).not.toMatch(/<script|<iframe|onclick=/);
		const note = all.find((item) => item.link.endsWith("/#post-verification-note-0"))!;
		expect(note.html).toContain("完整内容仍然可以打开阅读");
		expect(note.html).not.toContain("export const");
		expect(note.guid).toContain(`/${lang}/posts/#post-verification-note-0/`);
		const music = all.find((item) => item.link.endsWith("/#post-verification-music"))!;
		expect(music.html).toContain("测试歌曲");
		expect(music.html).toContain("https://open.spotify.com/");
		expect(music.html).toContain("/__test__/silence.wav");
	});
}

test("subscription choices copy the right feed and reflow with larger text", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto("/zh/subscribe/");
	await expect(page.locator(".subscription-option")).toHaveCount(3);
	for (const option of await page.locator(".subscription-option").all()) {
		const url = await option.locator(".subscription-address").getAttribute("href");
		await option.getByRole("button", { name: "复制订阅地址" }).click();
		await expect(option.getByRole("status")).toHaveText("链接已复制");
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
	}
	await page.addStyleTag({ content: "html{font-size:200%}" });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("MDX notes stay readable and all three categories remain available", async ({ page }) => {
	await page.goto("/zh/");
	await expect(page.locator(".latest-note")).toHaveCount(0);
	await expect(page.locator(".recent-notes .note-preview-text").first()).not.toContainText(
		"export const",
	);
	await page.locator('.preview-detail[href="/zh/posts/#post-verification-note-0"]').click();
	await expect(page).toHaveURL(/\/zh\/posts\/#post-verification-note-0$/);
	await expect(page.locator("#post-verification-note-0 .note-card__body")).not.toContainText(
		"export const",
	);
	for (const name of ["快录", "分享", "摘抄"]) {
		await expect(
			page.locator(".post-tabs").getByRole("button", { name, exact: true }),
		).toBeVisible();
	}
	await page.goto("/zh/about/");
	await expect(page.locator(".about__picks")).toHaveCount(0);
	await expect(page.getByRole("link", { name: /我的喜欢/ })).toHaveCount(0);
	await page.locator('.site-nav a[href="/zh/posts/"]').click();
	await page.locator(".post-tabs").getByRole("button", { name: "分享", exact: true }).click();
	await expect(page.locator("#post-verification-music")).toBeVisible();
	await expect(page).toHaveURL(/\/zh\/posts\/\?type=rec$/);
});
