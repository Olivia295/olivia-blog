import { expect, test } from "@playwright/test";

test("ink draws once, rests, and respects reduced motion", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/zh/");
	const stroke = page.locator(".signature-stroke path");
	await expect(stroke).toHaveCSS("animation-name", "minimal-ink-write");
	await expect(stroke).toHaveCSS("animation-iteration-count", "1");
	await expect
		.poll(() => stroke.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
		.toBe(0);
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(stroke).toHaveCSS("animation-name", "none");
	await expect(page.locator("#home-name")).toBeVisible();
	await expect(page.locator(".signature-stroke")).toHaveAttribute("aria-hidden", "true");
});

for (const { width, lang, colorScheme, reducedMotion } of [
	{ width: 320, lang: "zh", colorScheme: "light", reducedMotion: "no-preference" },
	{ width: 768, lang: "en", colorScheme: "dark", reducedMotion: "reduce" },
	{ width: 1440, lang: "zh", colorScheme: "light", reducedMotion: "no-preference" },
] as const) {
	test(`the hero postcard turns with the keyboard without disrupting the home at ${width}px`, async ({
		page,
	}) => {
		await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ colorScheme, reducedMotion });
		await page.goto(`/${lang}/`);
		const postcard = page.locator("details.hero-postcard");
		const summary = postcard.locator("summary");
		const portrait = summary.locator("img");
		const story = postcard.locator(".postcard-story");
		await expect(postcard).not.toHaveAttribute("open");
		await expect(portrait).toBeVisible();
		await expect(story).toBeHidden();
		await expect(summary).toHaveAccessibleName(
			new RegExp(lang === "zh" ? "翻到背面" : "Turn it over"),
		);
		await summary.focus();
		await page.keyboard.press("Enter");
		await expect(postcard).toHaveAttribute("open", "");
		await expect(summary).toBeFocused();
		await expect(portrait).toBeHidden();
		await expect(story).toBeVisible();
		await expect(story.locator("p")).toContainText(lang === "zh" ? "日记本" : "old diaries");
		await expect(summary).toHaveAccessibleName(lang === "zh" ? "回到正面" : "Back to the portrait");
		expect(
			await summary.evaluate((el) => el.getBoundingClientRect().height),
		).toBeGreaterThanOrEqual(44);
		expect(await story.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
		if (reducedMotion === "reduce") await expect(story).toHaveCSS("animation-name", "none");
		await expect(page.locator(".welcome-link")).toBeVisible();
		await expect(page.locator(".welcome-link")).toHaveAttribute("href", `/${lang}/about/`);
		const notes = await page.locator(".recent-notes").boundingBox();
		const articles = await page.locator(".recent-articles").boundingBox();
		if (!notes || !articles) throw new Error("Missing recent-content columns");
		if (width >= 860) expect(articles.x).toBeGreaterThanOrEqual(notes.x + notes.width);
		else expect(articles.y).toBeGreaterThanOrEqual(notes.y + notes.height);
		const excerpt = page.locator(
			`.note-preview:has(.preview-detail[href="/${lang}/posts/#post-verification-excerpt"])`,
		);
		await expect(excerpt.locator(".note-preview-excerpt blockquote")).toContainText(
			"把想留下的句子",
		);
		await expect(excerpt.locator(".note-preview-excerpt blockquote strong")).toHaveText("句子");
		await expect(excerpt.locator(".note-preview-excerpt > p").first()).toHaveText(
			"这段引言保留普通正文的排版。",
		);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		await summary.focus();
		await page.keyboard.press("Space");
		await expect(postcard).not.toHaveAttribute("open");
		await expect(portrait).toBeVisible();
		await expect(story).toBeHidden();
		await expect(summary).toBeFocused();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
	});
}

test("the postcard front and back remain keyboard accessible without JavaScript", async ({
	browser,
	baseURL,
}) => {
	if (!baseURL) throw new Error("Missing test server address");
	const context = await browser.newContext({
		baseURL,
		javaScriptEnabled: false,
		viewport: { width: 320, height: 900 },
		colorScheme: "dark",
		reducedMotion: "reduce",
	});
	try {
		const page = await context.newPage();
		await page.goto("/en/");
		const postcard = page.locator("details.hero-postcard");
		const summary = postcard.locator("summary");
		await summary.press("Space");
		await expect(postcard).toHaveAttribute("open", "");
		await expect(postcard.locator(".postcard-story")).toBeVisible();
		await expect(postcard.locator(".postcard-story p")).toContainText("old diaries");
		await expect(summary.locator("img")).toBeHidden();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		await summary.press("Enter");
		await expect(postcard).not.toHaveAttribute("open");
		await expect(summary.locator("img")).toBeVisible();
		await expect(postcard.locator(".postcard-story")).toBeHidden();
	} finally {
		await context.close();
	}
});

for (const width of [320, 1440]) {
	test(`text actions stay light, consistent and keyboard usable at ${width}px`, async ({
		page,
	}) => {
		await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto("/zh/");
		const welcome = page.getByRole("link", { name: "很高兴你来做客" });
		const bounds = await welcome.boundingBox();
		if (!bounds) throw new Error("Missing welcome link");
		expect(bounds.height).toBeGreaterThanOrEqual(44);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
		const typeStyle = await welcome.evaluate((el) => {
			const style = getComputedStyle(el);
			return {
				fontFamily: style.fontFamily,
				fontSize: style.fontSize,
				fontWeight: style.fontWeight,
			};
		});
		for (const action of [
			welcome,
			page.locator(".site-footer .rss-link"),
			page.locator(".recent-notes .home-more"),
		]) {
			await expect(action).toHaveCSS("border-width", "0px");
			await expect(action).toHaveCSS("box-shadow", "none");
			const style = await action.evaluate((el) => {
				const computed = getComputedStyle(el);
				return {
					fontFamily: computed.fontFamily,
					fontSize: computed.fontSize,
					fontWeight: computed.fontWeight,
				};
			});
			expect(style).toEqual(typeStyle);
		}
		const resting = await welcome.evaluate((el) => getComputedStyle(el).backgroundColor);
		await welcome.hover();
		await expect
			.poll(() => welcome.evaluate((el) => getComputedStyle(el).backgroundColor))
			.not.toBe(resting);
		await expect(welcome).toHaveCSS("transform", "none");
		expect(
			await welcome
				.locator(".action-label")
				.evaluate((el) => getComputedStyle(el, "::after").maskImage),
		).toContain("data:image/svg+xml");
		await page.emulateMedia({ reducedMotion: "reduce" });
		await expect(welcome).toHaveCSS("transform", "none");
		await welcome.focus();
		await expect(welcome).toBeFocused();
		await expect(welcome).toHaveCSS("outline-style", "solid");
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL(/\/zh\/about\/$/);
		await expect(page.locator(".about__name")).toBeVisible();
	});

	test(`Chinese headings and drawn navigation stay clear while scrolling at ${width}px`, async ({
		page,
	}) => {
		await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: "no-preference" });
		await page.goto("/zh/");
		await expect(page.locator(".section-heading > span")).toHaveCount(0);
		// The logo links home, so the drawn current-page line is checked on a section page.
		await page.goto("/zh/blogs/");
		const selected = page.locator('.site-nav__link[aria-current="page"]');
		expect(await selected.evaluate((el) => getComputedStyle(el, "::after").maskImage)).toContain(
			"data:image/svg+xml",
		);
		expect(await selected.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe(
			"minimal-ink-line",
		);
		await page.getByRole("navigation").getByRole("link", { name: "关于", exact: true }).click();
		await page.locator(".site-footer").scrollIntoViewIfNeeded();
		await expect(page.locator("#main-header")).toBeInViewport();
		await expect(page.locator("#main-header")).toHaveCSS("backdrop-filter", "blur(18px)");
		await page.getByRole("navigation").getByRole("link", { name: "随记", exact: true }).click();
		await expect(page).toHaveURL(/\/zh\/posts\/$/);
		await page.getByRole("button", { name: "分享", exact: true }).click();
		const filter = page.locator('.post-tabs__item[aria-pressed="true"]');
		expect(await filter.evaluate((el) => getComputedStyle(el, "::after").maskImage)).toContain(
			"data:image/svg+xml",
		);
		await page.emulateMedia({ reducedMotion: "reduce" });
		expect(await filter.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe(
			"none",
		);
		expect(await selected.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe(
			"none",
		);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
	});

	test(`shared websites follow personal links without narrowing the page at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/zh/about/");
		const shared = page.getByRole("region", { name: "推荐前往" });
		await expect(shared.getByRole("link", { name: "The Nicest Place" })).toHaveAttribute(
			"href",
			"https://thenicestplace.net/",
		);
		for (const [name, href] of [
			["思方网", "https://philosophy.hku.hk/think/"],
			["Oinja", "https://oinja-website.vercel.app/"],
		] as const) {
			const link = shared.getByRole("link", { name, exact: true });
			await expect(link).toBeVisible();
			await expect(link).toHaveAttribute("href", href);
		}
		await expect(
			page.locator(".about__friends").first().getByRole("link", { name: "GitHub" }),
		).toBeVisible();
		expect(
			await shared.evaluate((el) =>
				el.previousElementSibling?.classList.contains("about__friends"),
			),
		).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
	});
}
