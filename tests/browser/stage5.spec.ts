import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";

const routes = [
	"/zh/",
	"/zh/blogs/",
	"/zh/posts/",
	"/zh/gallery/",
	"/zh/about/",
	"/en/",
	"/en/about/",
	"/zh/blogs/verification-reading/",
];
test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.emulateMedia({ reducedMotion: "reduce" });
});
async function noOverflow(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function loadVisibleImages(page: Page) {
	const images = page.locator("main img:visible");
	for (const img of await images.all()) {
		await img.scrollIntoViewIfNeeded();
		await expect
			.poll(() =>
				img.evaluate((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0),
			)
			.toBe(true);
	}
}
for (const width of [320, 390, 768, 1440]) {
	test(`all main routes, image loading and document flow at ${width}px`, async ({ page }) => {
		test.setTimeout(90_000);
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		await page.setViewportSize({ width, height: 900 });
		for (const route of routes) {
			const response = await page.goto(route);
			expect(response?.status(), route).toBe(200);
			await expect(page.locator("main")).toBeVisible();
			await noOverflow(page);
			await loadVisibleImages(page);
			await noOverflow(page);
		}
		if (width === 320) {
			await page.goto("/en/about/");
			await page.addStyleTag({ content: "html { font-size: 200%; }" });
			await noOverflow(page);
			expect(
				await page
					.locator(".about__fact dd")
					.evaluateAll((facts) => facts.every((fact) => fact.scrollWidth <= fact.clientWidth)),
			).toBe(true);
		}
		await page.goto("/zh/gallery/");
		await page.locator("a.set").first().click();
		await loadVisibleImages(page);
		await noOverflow(page);
		expect(errors).toEqual([]);
	});
}
for (const width of [320, 390, 1440]) {
	for (const theme of ["light", "dark"] as const) {
		test(`all page types meet WCAG AA at ${width}px in ${theme}`, async ({ page }) => {
			test.setTimeout(90_000);
			await page.setViewportSize({ width, height: 900 });
			await page.emulateMedia({ colorScheme: theme });
			const violations = [];
			for (const route of routes) {
				await page.goto(route);
				const result = await new AxeBuilder({ page })
					.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
					.analyze();
				for (const violation of result.violations)
					violations.push({
						route,
						id: violation.id,
						nodes: violation.nodes.map((node) => ({
							target: node.target,
							summary: node.failureSummary,
						})),
					});
			}
			expect(violations).toEqual([]);
		});
	}
	test(`reading anchors, keyboard access and return position at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/zh/blogs/verification-reading/");
		await page.keyboard.press("Tab");
		await expect(page.locator(".skip-link")).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(page.locator("#main")).toBeFocused();
		if (width <= 800) await page.locator(".article-toc summary").click();
		const anchor = page.locator(".article-toc a").filter({ hasText: "一点代码" });
		const href = await anchor.getAttribute("href");
		if (!href) throw new Error("Missing TOC destination");
		await anchor.click();
		const heading = page.locator(href);
		await expect(heading).toBeInViewport();
		const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
		const headerBottom = await page
			.locator("#main-header")
			.evaluate((el) => el.getBoundingClientRect().bottom);
		expect(top).toBeGreaterThanOrEqual(headerBottom);
		const code = page.locator(".reading-body pre");
		expect(
			await code.evaluate(
				(el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === "auto",
			),
		).toBe(true);
		await noOverflow(page);
		await page.goto("/zh/");
		const link = page.locator('.log-entry[data-kind="blog"] h3 a').last();
		await link.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
		const position = await page.evaluate(() => scrollY);
		expect(position).toBeGreaterThan(100);
		await link.click();
		await page.goBack();
		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(position - 10);
		expect(Math.abs((await page.evaluate(() => scrollY)) - position)).toBeLessThan(10);
	});
	test(`production search returns articles, empty results and keyboard focus at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/zh/");
		const opener = page.locator("[data-open-modal]");
		await opener.focus();
		await page.keyboard.press("Control+k");
		const dialog = page.locator("site-search dialog");
		await expect(dialog).toBeVisible();
		const input = page.locator(".pagefind-ui__search-input");
		// A specific title fragment stays meaningful as the note archive grows.
		await input.fill("窄屏阅读");
		await expect(
			page.locator('.pagefind-ui__result-link[href="/zh/blogs/verification-reading/"]'),
		).toBeVisible();
		await noOverflow(page);
		const result = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
			.analyze();
		expect(result.violations).toEqual([]);
		await input.fill("xyzzyunfindableword12345");
		await expect(page.locator(".pagefind-ui__message")).toContainText(/0|没有|未找到|No results/i);
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();
		await expect(opener).toBeFocused();
	});
}
// Use actual pointer input after hit-testing: Chromium with scripting disabled can
// suspend the animation-frame callbacks used by locator.click's stability polling.
async function clickWithoutScript(page: Page, link: Locator) {
	await expect(link).toBeVisible();
	await link.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
	const target = await link.evaluate((el) => {
		const box = el.getBoundingClientRect();
		const x = box.left + box.width / 2;
		const y = box.top + box.height / 2;
		return { x, y, reachable: el.contains(document.elementFromPoint(x, y)) };
	});
	expect(target.reachable).toBe(true);
	await page.mouse.click(target.x, target.y);
}
for (const width of [390, 1440]) {
	test(`content remains usable without JavaScript at ${width}px`, async ({ browser }) => {
		const context = await browser.newContext({
			javaScriptEnabled: false,
			viewport: { width, height: 900 },
		});
		const page = await context.newPage();
		await page.goto("http://127.0.0.1:4323/zh/");
		await expect(page.locator("#home-name")).toBeVisible();
		await expect(page.locator("#boarding")).not.toBeVisible();
		await clickWithoutScript(page, page.locator('.log-entry[data-kind="blog"] h3 a').first());
		await expect(page.locator(".reading-body")).toBeVisible();
		await noOverflow(page);
		await page.goto("http://127.0.0.1:4323/zh/gallery/");
		await clickWithoutScript(page, page.locator("a.set").first());
		const original = page.locator("[data-photo-src]").first();
		const href = await original.getAttribute("href");
		expect(href).toBeTruthy();
		const destination = new URL(href ?? "missing", page.url()).href;
		await clickWithoutScript(page, original);
		await page.waitForURL(destination);
		await expect
			.poll(() =>
				page
					.locator("body img")
					.first()
					.evaluate((el) => el instanceof HTMLImageElement && el.complete && el.naturalWidth > 0),
			)
			.toBe(true);
		expect(
			await page
				.locator("body img")
				.evaluateAll((nodes) =>
					nodes.some((el) => el instanceof HTMLImageElement && el.naturalWidth > 0),
				),
		).toBe(true);
		await context.close();
	});
	test(`home visual stability and final renders at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript(() => {
			const measurements = { cls: 0, lcp: 0 };
			Object.assign(window, { shipMetrics: measurements });
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries())
					if (!(entry as PerformanceEntry & { hadRecentInput: boolean }).hadRecentInput)
						measurements.cls += (entry as PerformanceEntry & { value: number }).value;
			}).observe({ type: "layout-shift", buffered: true });
			new PerformanceObserver((list) => {
				measurements.lcp = list.getEntries().at(-1)?.startTime ?? 0;
			}).observe({ type: "largest-contentful-paint", buffered: true });
		});
		await page.goto("/zh/");
		await loadVisibleImages(page);
		await page.evaluate(() => scrollTo(0, 0));
		await mkdir("artifacts/final", { recursive: true });
		const metrics = await page.evaluate(
			() => (window as Window & { shipMetrics?: { cls: number; lcp: number } }).shipMetrics,
		);
		expect(metrics?.cls).toBeLessThan(0.1);
		expect(metrics?.lcp).toBeGreaterThan(0);
		expect(metrics?.lcp).toBeLessThan(2500);
		await writeFile(`artifacts/final/metrics-${width}.json`, JSON.stringify(metrics, null, 2));
		for (const theme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme: theme });
			await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
			await page.screenshot({ path: `artifacts/final/home-${width}-${theme}.png`, fullPage: true });
		}
		await page.goto("/zh/blogs/verification-reading/");
		await page.screenshot({ path: `artifacts/final/article-${width}.png`, fullPage: true });
	});
}

test("missing routes keep useful, accessible navigation in both languages", async ({ page }) => {
	for (const lang of ["zh", "en"]) {
		await page.goto(`/${lang}/a-route-that-does-not-exist/`);
		await expect(page.locator("[data-404]")).toBeVisible();
		await expect(page.locator("[data-404-body]")).not.toContainText(/厨房|菜|dish|menu/i);
		await expect(page.locator("[data-404-home]")).toHaveAttribute("href", `/${lang}/`);
		for (const colorScheme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme });
			const result = await new AxeBuilder({ page })
				.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
				.analyze();
			expect(result.violations).toEqual([]);
		}
		await page.locator("[data-404-home]").click();
		await expect(page.locator("#home-name")).toBeVisible();
	}
});

test("mobile floating controls stay within the viewport and support touch-size actions", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	await page.setViewportSize({ width: 320, height: 780 });
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/zh/");
	const panel = page.locator("[data-toggle-space]");
	const bounds = await panel.boundingBox();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
	expect(
		await page
			.locator("[data-toggle-space], [data-replay-boarding]")
			.evaluateAll((nodes) => nodes.every((node) => node.getBoundingClientRect().height >= 44)),
	).toBe(true);
	await page.locator("[data-toggle-space]").click();
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
	const scan = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(scan.violations).toEqual([]);
});
test("a stored pause prevents automatic boarding even without a seen marker", async ({ page }) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.addInitScript(() => {
		localStorage.setItem("blog-skin", "spaceship");
		localStorage.removeItem("boarding-seen");
		localStorage.setItem("spaceship-motion-paused", "1");
	});
	await page.goto("/zh/");
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
	await expect(page.locator("#boarding")).not.toBeVisible();
	await page.locator(".home-cabin-controls [data-replay-boarding]").click();
	await expect(page.locator("#boarding")).toBeVisible();
	await page.locator("#skip-boarding").click();
	await expect(page.locator(".home-cabin-controls [data-replay-boarding]")).toBeFocused();
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
});
test("scene setting disables runtime animation and essential copy survives a failed backdrop", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.route("**/zh/", async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			body: (await response.text()).replace(
				'data-space-enabled="true"',
				'data-space-enabled="false"',
			),
		});
	});
	await page.route("**/ship/hangar.webp", (route) => route.abort());
	await page.goto("/zh/");
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "disabled");
	await expect(page.locator(".hangar-traffic")).toHaveAttribute("data-space-active", "false");
	await expect(page.locator("#home-name")).toBeVisible();
	await expect(page.locator("[data-toggle-space]")).toBeDisabled();
	await expect(page.locator(".hero-portrait img")).toBeVisible();
	await noOverflow(page);
});
test("long names and 200 percent text keep portrait, notes, writing and controls in document flow", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "spaceship"));
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/en/");
	await page.locator("#home-name").evaluate((el) => {
		el.textContent = "A very long personal name, writing and wandering across the stars";
	});
	await page.addStyleTag({ content: "html{font-size:200%}" });
	await noOverflow(page);
	await expect(page.locator(".latest-note")).toHaveCount(0);
	await expect(page.locator(".recent-notes")).toBeVisible();
	await expect(page.locator(".recent-articles")).toBeVisible();
	const regions = await page
		.locator(".foyer-copy,.hero-portrait,.recent-notes,.recent-articles,.home-cabin-controls")
		.evaluateAll((nodes) => nodes.map((el) => el.getBoundingClientRect().top));
	expect(regions).toEqual([...regions].sort((a, b) => a - b));
	await page.locator(".home-cabin-controls [data-replay-boarding]").scrollIntoViewIfNeeded();
	await expect(page.locator("[data-toggle-space]")).toBeVisible();
});
