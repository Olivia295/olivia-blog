import { mkdir } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
});
for (const width of [320, 390, 768, 1440]) {
	test(`foundation: navigation, grouped summaries and reading at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto("/zh/");
		await expect(page.locator("#home-name")).toBeVisible();
		await expect(page.getByRole("heading", { name: "最近短记" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "最近文章" })).toBeVisible();
		await expect(page.locator('.log-entry[data-kind="post"]')).toHaveCount(3);
		await expect(page.locator('.log-entry[data-kind="blog"]')).toHaveCount(5);
		for (const kind of ["post", "blog"]) {
			const dates = await page
				.locator(`.log-entry[data-kind="${kind}"]`)
				.evaluateAll((nodes) => nodes.map((node) => Date.parse(node.getAttribute("data-date")!)));
			expect(dates).toEqual([...dates].sort((a, b) => b - a));
		}
		await expect(page.locator(".explore-links,.window-sill")).toHaveCount(0);
		const columns = await page.locator(".recent-column").evaluateAll((nodes) =>
			nodes.map((el) => {
				const { x, y, height } = el.getBoundingClientRect();
				return { x, y, height };
			}),
		);
		if (width >= 860) {
			expect(columns[0]!.y).toBe(columns[1]!.y);
			expect(columns[0]!.height).toBe(columns[1]!.height);
			const bottoms = await page
				.locator(".recent-column .home-more")
				.evaluateAll((nodes) => nodes.map((el) => el.getBoundingClientRect().bottom));
			expect(bottoms[0]).toBe(bottoms[1]);
		} else {
			expect(columns[0]!.y + columns[0]!.height).toBeLessThan(columns[1]!.y);
		}
		expect(
			await page
				.locator(".hero-portrait img")
				.evaluate(
					(el: HTMLImageElement) =>
						el.complete &&
						el.naturalWidth > 0 &&
						Math.abs(el.width / el.height - el.naturalWidth / el.naturalHeight) < 0.01,
				),
		).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		expect(
			await page
				.locator(".site-nav a")
				.evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44)),
		).toBe(true);
		await mkdir("artifacts/foundation", { recursive: true });
		await page.screenshot({ path: `artifacts/foundation/home-${width}.png`, fullPage: true });
		const articleLink = page.locator('.log-entry[data-kind="blog"] h3 a').first();
		await articleLink.click();
		await expect(page.locator(".reading-body")).toBeVisible();
		await page.goto("/zh/blogs/verification-reading/");
		await expect(page.locator(".reading-body")).toBeVisible();
		if (width <= 800) await expect(page.locator(".article-toc")).not.toHaveAttribute("open");
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(280);
		await page.locator("#floating-back").click();
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
		await page.screenshot({ path: `artifacts/foundation/article-${width}.png`, fullPage: true });
	});
}
test("theme persists, follows system until chosen, and survives blocked storage", async ({
	page,
}) => {
	await page.emulateMedia({ colorScheme: "light" });
	await page.goto("/zh/");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await page.emulateMedia({ colorScheme: "dark" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "true");
	await page.getByRole("switch").click();
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("Storage unavailable");
			},
		});
	});
	await page.reload();
	await page.getByRole("switch").click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
for (const theme of ["light", "dark"] as const) {
	test(`home accessibility in ${theme} lighting`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
		await page.goto("/zh/");
		const result = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
			.analyze();
		expect(result.violations).toEqual([]);
	});
}
test("long site names and 200% text retain navigation and reflow", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/en/");
	await page
		.locator(".site-wordmark")
		.evaluate(
			(el) => (el.textContent = "A very long personal spaceship name that should wrap naturally"),
		);
	await page.addStyleTag({ content: "html{font-size:200%}" });
	await expect(page.getByRole("navigation", { name: "Main menu" })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("summary bounds preserve full-note access, photo count and natural scrolling", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/zh/");
	const note = page.locator(".note-preview").first();
	await expect(note.locator("img")).toHaveCount(1);
	await expect(note.locator(".photo-count")).toContainText("2 张照片");
	expect(
		await note
			.locator(".note-preview-text")
			.evaluate(
				(el) =>
					el.getBoundingClientRect().height <=
					Number.parseFloat(getComputedStyle(el).lineHeight) * 4 + 1,
			),
	).toBe(true);
	await note.locator(".preview-detail").click();
	const full = page.locator("#post-verification-note-0");
	await expect(full).toBeInViewport();
	expect(await full.locator(".note-card__body").innerText()).toContain("完整内容仍然可以打开阅读");
	await expect(full.locator("img")).toHaveCount(2);
});
test("short-page footer reaches the viewport bottom and long pages never cover content", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 2400 });
	await page.goto("/zh/about/");
	const footer = page.locator(".site-footer");
	expect(
		await footer.evaluate((el) => Math.abs(el.getBoundingClientRect().bottom - innerHeight)),
	).toBeLessThanOrEqual(1);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/zh/");
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
	expect(await footer.evaluate((el) => getComputedStyle(el).position)).not.toBe("fixed");
	const mainBottom = await page.locator("main").evaluate((el) => el.getBoundingClientRect().bottom);
	expect(await footer.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(
		mainBottom,
	);
});
