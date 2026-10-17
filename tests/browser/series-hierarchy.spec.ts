import { expect, test } from "@playwright/test";

const eras = [
	{ id: "icy-era", article: "IcyEra-01", zh: "冷冰时代", en: "Icy Era" },
	{ id: "jade-era", article: "JadeEra-01", zh: "绿玉时代", en: "Jade Era" },
	{ id: "wooden-era", article: "WoodenEra-01", zh: "秀木时代", en: "Wooden Era" },
	{ id: "golden-era", article: "GoldenEra-01", zh: "黄金时代", en: "Golden Era" },
];

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem("boarding-seen", "1");
	});
	await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const lang of ["zh", "en"] as const) {
	test(`parent series aggregate their stories and keep leaf navigation in ${lang}`, async ({
		page,
	}) => {
		await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`/${lang}/blogs/?series=era-memoirs`);
		const board = page.locator(".blogs-board");
		const parent = page.locator('[data-panel="era-memoirs"]');
		await expect(board).toHaveAttribute("data-series", "era-memoirs");
		await expect(parent).toBeVisible();
		await expect(parent.locator(".series-intro__meta")).toContainText(
			lang === "zh" ? "5 篇文章" : "5 articles",
		);
		const parentLinks = await parent
			.locator(".blog-row__title a")
			.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
		expect(parentLinks.sort()).toEqual(
			["AboutEras", ...eras.map((era) => era.article)].map((id) => `/${lang}/blogs/${id}/`).sort(),
		);
		expect(new Set(parentLinks).size).toBe(5);
		for (const era of eras) {
			const button = page.locator(`.series-nav__btn[data-series="${era.id}"]`);
			await expect(button).toHaveAttribute("data-parent", "era-memoirs");
			await expect(button).toHaveAccessibleName(era[lang]);
			await button.press("Enter");
			await expect(board).toHaveAttribute("data-series", era.id);
			await expect(button).toHaveAttribute("aria-pressed", "true");
			const child = page.locator(`[data-panel="${era.id}"]`);
			await expect(child.locator(".blog-row__title a")).toHaveCount(1);
			await expect(child.locator(".blog-row__title a")).toHaveAttribute("href", `/${lang}/blogs/${era.article}/`);
			await expect(child.locator(".series-intro__meta")).toContainText(
				lang === "zh" ? "1 篇文章" : "1 articles",
			);
		}
		await page.goto(`/${lang}/blogs/IcyEra-01/`);
		const trail = page.locator(".article-series");
		await expect(trail.locator("a")).toHaveText([
			lang === "zh" ? "时代回忆录" : "Era Memoirs",
			lang === "zh" ? "冷冰时代" : "Icy Era",
		]);
		await expect(trail.locator("a").first()).toHaveAttribute(
			"href",
			`/${lang}/blogs/?series=era-memoirs`,
		);
		await expect(trail.locator("a").last()).toHaveAttribute(
			"href",
			`/${lang}/blogs/?series=icy-era`,
		);
		await trail.locator("a").first().click();
		await expect(board).toHaveAttribute("data-series", "era-memoirs");
		await page.goto(`/${lang}/blogs/AboutEras/`);
		await expect(page.locator('.article-series a[href$="series=nexus-codex"]')).toHaveText(
			lang === "zh" ? "枢纽宝典" : "Nexus Codex",
		);
		await expect(page.locator('.article-series a[href$="series=era-memoirs"]')).toHaveCount(1);
		await expect(
			page.locator(
				'.article-series a[href$="series=icy-era"], .article-series a[href$="series=jade-era"], .article-series a[href$="series=wooden-era"], .article-series a[href$="series=golden-era"]',
			),
		).toHaveCount(0);
	});
}

for (const skin of ["minimal", "spaceship"]) {
	test(`planned subseries stay usable on a dark English phone in ${skin}`, async ({ page }) => {
		await page.addInitScript((name) => {
			localStorage.setItem("blog-skin", name);
			localStorage.setItem("theme", "dark");
		}, skin);
		await page.setViewportSize({ width: 320, height: 900 });
		await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
		await page.goto("/en/blogs/?series=embodied-records");
		await expect(page.locator("html")).toHaveAttribute("data-skin", skin);
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		const menu = page.locator(".series-menu");
		for (const id of ["embodied-records", "media-reviews", "game-reviews"]) {
			await expect(menu).not.toHaveAttribute("open");
			await menu.locator("summary").press("Enter");
			await expect(menu).toHaveAttribute("open");
			const button = page.locator(`.series-nav__btn[data-series="${id}"]`);
			if (id !== "embodied-records")
				await expect(button).toHaveAttribute("data-parent", "embodied-records");
			await button.press("Enter");
			await expect(menu).not.toHaveAttribute("open");
			await expect(menu.locator("summary")).toBeFocused();
			await expect(page.locator(".blogs-board")).toHaveAttribute("data-series", id);
			const panel = page.locator(`[data-panel="${id}"]`);
			await expect(panel).toBeVisible();
			if (id !== "embodied-records") {
				await expect(panel.locator(".blog-row__title a")).toHaveCount(0);
				await expect(panel.locator(".series-intro__meta")).toContainText("0 articles");
				await expect(panel.getByRole("link", { name: "Start with the first story" })).toHaveCount(
					0,
				);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
		}
		await page.goto("/en/blogs/IcyEra-01/");
		await expect(page.locator(".article-series a")).toHaveCount(2);
		expect(
			await page.locator(".article-series").evaluate((el) => el.scrollWidth <= el.clientWidth),
		).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
	});
}
