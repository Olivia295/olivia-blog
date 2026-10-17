import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
});
test("navigation: desktop search precedes Home and mobile keeps its original tools", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/en/");
	await expect(page.locator(".cabin-console")).toHaveCount(0);
	await expect(page.locator("#search")).toHaveCount(1);
	const search = await page.locator("#search").boundingBox();
	const home = await page.locator("nav a").first().boundingBox();
	expect(search!.x + search!.width).toBeLessThan(home!.x);
	await page.locator("#search > button").focus();
	await page.keyboard.press("Tab");
	await expect(page.locator("nav a").first()).toBeFocused();
	await page.keyboard.press("Control+k");
	await expect(page.locator("#search dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.locator(".header-tools nav")).toHaveCount(0);
	await expect(page.locator(".header-tools #search")).toHaveCount(1);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const toggle = await page.locator("[data-toggle-space]").boundingBox();
	expect(toggle!.x).toBeGreaterThanOrEqual(0);
	expect(toggle!.x).toBeLessThan(24);
	expect(toggle!.y + toggle!.height).toBeLessThanOrEqual(844);
});

test("series: translations, aliases, language switching and legacy links agree", async ({
	page,
}) => {
	await page.goto("/en/");
	const labels = page.locator(
		'.recent-articles .log-entry:has(a[href="/en/blogs/AboutEras/"]) .preview-tags',
	);
	await expect(labels).toContainText("Nexus Codex");
	await expect(labels).toContainText("Era Memoirs");
	await expect(labels).not.toContainText(/枢纽宝典|时代回忆录/);
	await page.goto(`/zh/blogs/?series=${encodeURIComponent("旧测试系列")}`);
	await expect(page.locator(".blogs-board")).toHaveAttribute("data-series", "verification");
	const panel = page.locator('[data-panel="verification"]');
	await expect(panel.getByRole("heading", { name: "测试系列", exact: true })).toBeVisible();
	await expect(panel).toContainText("测试系列介绍");
	await expect(panel).toContainText("2 篇文章 · 按发布先后阅读");
	await expect(panel.getByRole("link", { name: "从第一篇读起" })).toHaveAttribute(
		"href",
		"/zh/blogs/verification-reading/",
	);
	expect(
		await panel
			.locator("h3 a")
			.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
	).toEqual(["/zh/blogs/verification-reading/", "/zh/blogs/verification-reading-next/"]);
	await page.locator('[data-set-locale="en"]').click();
	await expect(page).toHaveURL(/\/en\/blogs\/\?series=verification/);
	await expect(page.locator('[data-series="verification"].series-nav__btn')).toHaveAccessibleName(
		"Verification series",
	);
	await expect(panel).toContainText("Test series introduction");
	await expect(page.locator('[data-series="verification"].series-nav__btn')).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.goto("/en/tags/old%20verification/");
	await expect(page).toHaveURL(/\/en\/blogs\/\?series=verification/);
	await page.goto("/en/blogs/tags/verification%20series/");
	await expect(page).toHaveURL(/\/en\/blogs\/\?series=verification/);
	await page.goto("/en/blogs/AboutEras/");
	await expect(page.locator('#blog-hero a[href$="series=nexus-codex"]')).toHaveText("Nexus Codex");
});

test("layout: content routes share window gutters and the same scroll treatment", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.setViewportSize({ width: 1440, height: 500 });
	await page.goto("/zh/");
	await page.locator(".recent-columns").scrollIntoViewIfNeeded();
	await expect(page.locator("#main")).toHaveAttribute("data-header-overlap", "true");
	await expect(
		page.locator('#main [data-skin-layer="spaceship"] .content-soft-edge'),
	).toBeVisible();
	await page.goto("/zh/gallery/");
	const album = await page.locator("a.set").first().getAttribute("href");
	if (!album) throw new Error("Missing album route");
	let firstGap = 0;
	for (const route of [
		"blogs/",
		"posts/",
		"gallery/",
		"about/",
		"blogs/verification-reading/",
		album.replace("/zh/", ""),
	]) {
		await page.goto(`/zh/${route}`);
		const main = await page.locator("#main").boundingBox();
		const left = await page.locator(".surround-window-left").boundingBox();
		const right = await page.locator(".surround-window-right").boundingBox();
		const gap = main!.x - left!.x - left!.width;
		if (!firstGap) firstGap = gap;
		expect(Math.abs(gap - firstGap)).toBeLessThan(1);
		expect(gap).toBeGreaterThanOrEqual(23);
		expect(gap).toBeLessThanOrEqual(25);
		expect(Math.abs(right!.x - main!.x - main!.width - gap)).toBeLessThan(1);
		await page.evaluate(() => scrollTo({ top: 210, behavior: "instant" }));
		await expect(page.locator("#main")).toHaveAttribute("data-header-overlap", "true");
		expect(await page.locator("#main").evaluate((el) => getComputedStyle(el).maskImage)).toContain(
			"linear-gradient",
		);
		expect(
			await page.locator("#main-header").evaluate((el) => getComputedStyle(el).backdropFilter),
		).toBe("blur(16px)");
	}
});

test("traffic: distinct ships and planets cross inside the window and pause together", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/zh/");
	const scene = page.locator(".surround-window-left .space-scene");
	await expect(scene).toHaveAttribute("data-space-active", "true");
	const craft = await scene
		.locator(".craft-main > path:first-child")
		.evaluateAll((els) => els.map((el) => [el.getAttribute("d"), el.getAttribute("fill")]));
	expect(new Set(craft.map((row) => row[0])).size).toBeGreaterThanOrEqual(4);
	expect(new Set(craft.map((row) => row[1])).size).toBeGreaterThanOrEqual(4);
	for (const item of await scene.locator(".passing-ship, .passing-planet").all()) {
		await item.evaluate((el) => {
			const style = getComputedStyle(el);
			el.getAnimations()[0]!.currentTime =
				(Number.parseFloat(style.animationDelay) +
					Number.parseFloat(style.animationDuration) * 0.1) *
				1000;
		});
	}
	await page.waitForTimeout(50);
	for (const item of await scene.locator(".passing-ship, .passing-planet").all()) {
		expect(
			await item.evaluate((el) => {
				const box = el.getBoundingClientRect();
				const window = el.parentElement!.getBoundingClientRect();
				return (
					Number(getComputedStyle(el).opacity) > 0.1 &&
					box.right > window.left &&
					box.left < window.right
				);
			}),
		).toBe(true);
	}
	await page.locator("[data-toggle-space]").click();
	const clocks = () =>
		scene
			.locator(".passing-ship, .passing-planet")
			.evaluateAll((els) => els.map((el) => el.getAnimations()[0]!.currentTime));
	await expect
		.poll(() =>
			scene
				.locator(".passing-ship, .passing-planet")
				.evaluateAll((els) =>
					els.every((el) =>
						el
							.getAnimations()
							.every((animation) => animation.playState === "paused" && !animation.pending),
					),
				),
		)
		.toBe(true);
	const before = await clocks();
	await page.waitForTimeout(180);
	expect(await clocks()).toEqual(before);
	await page.screenshot({ path: "artifacts/revision3/traffic-paused.png" });
	await page.emulateMedia({ reducedMotion: "reduce" });
	expect(
		await scene
			.locator(".passing-planet")
			.evaluateAll((els) => els.every((el) => el.getAnimations().length === 0)),
	).toBe(true);
});

test("footer: RSS precedes copyright in one row clear of floating controls", async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	for (const width of [320, 390, 1440, 2194]) {
		await page.setViewportSize({ width, height: 900 });
		for (const route of ["/en/about/", "/zh/blogs/verification-reading/"]) {
			await page.goto(route);
			await page.locator(".site-footer").scrollIntoViewIfNeeded();
			await expect(page.locator(".site-footer")).not.toContainText(/A little light|留一盏灯/);
			const footer = await page.locator(".site-footer").boundingBox();
			const label = await page.locator(".site-footer p").boundingBox();
			const rss = await page.locator(".site-footer .rss-link").boundingBox();
			const toggle = await page.locator("[data-toggle-space]").boundingBox();
			if (!footer || !label || !rss || !toggle)
				throw new Error("Missing footer or floating control");
			expect(label.y).toBeGreaterThan(footer.y + 16);
			expect(Math.abs(label.y + label.height / 2 - (rss.y + rss.height / 2))).toBeLessThan(1);
			expect(rss.x + rss.width).toBeLessThan(label.x);
			expect(
				await page.locator(".site-footer").evaluate((el) => getComputedStyle(el).borderTopWidth),
			).toBe("1px");
			expect(label.y + label.height <= toggle.y || label.x >= toggle.x + toggle.width).toBe(true);
			expect(rss.y + rss.height <= toggle.y || rss.x >= toggle.x + toggle.width).toBe(true);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
			await page.screenshot({
				path: `artifacts/revision3/footer-${width}-${route.includes("about") ? "short" : "long"}.png`,
			});
		}
	}
	const hull = await page.locator(".ship-surround").boundingBox();
	const window = await page.locator(".surround-window-left").boundingBox();
	expect(window!.y - hull!.y).toBeGreaterThan(16);
	expect(window!.y - hull!.y).toBeLessThan(24);
});
