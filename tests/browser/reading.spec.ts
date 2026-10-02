import { expect, test } from "@playwright/test";

const article = "/zh/blogs/verification-reading/";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const skin of ["minimal", "spaceship"]) {
	for (const width of [320, 1440]) {
		test(`reading controls and navigation work in ${skin} at ${width}px`, async ({ page }) => {
			await page.addInitScript((name) => localStorage.setItem("blog-skin", name), skin);
			await page.setViewportSize({ width, height: 900 });
			await page.goto(article);
			const metadata = page.locator(".article-meta");
			const copyButton = metadata.locator(".copy-trigger");
			await expect(page.locator("[data-copy-url]")).toHaveCount(1);
			await expect(copyButton).toHaveAccessibleName("复制链接");
			await expect(copyButton).toBeVisible();
			await expect(page.locator(".article-end .copy-link")).toHaveCount(0);
			expect(
				await copyButton.evaluate((el) => el.getBoundingClientRect().height),
			).toBeGreaterThanOrEqual(44);
			expect(await metadata.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
			if (width > 800) {
				const details = await metadata.locator(".article-meta__details").boundingBox();
				const button = await copyButton.boundingBox();
				if (!details || !button) throw new Error("Missing article metadata");
				expect(
					Math.abs(details.y + details.height / 2 - button.y - button.height / 2),
				).toBeLessThan(1);
			}
			const toc = page.locator(".article-toc");
			if (width <= 800) {
				await expect(toc).not.toHaveAttribute("open");
				await toc.locator("summary").press("Enter");
			} else {
				await expect(toc).toHaveAttribute("open");
				await expect(toc).toHaveCSS("position", "sticky");
			}
			await expect(toc.getByRole("navigation", { name: "目录" })).toBeVisible();
			expect(
				(await toc.locator("a").allTextContents()).some((text) => text.trim().startsWith("#")),
			).toBe(false);
			const parent = toc.getByRole("link", { name: "路上的记录", exact: true });
			const nested = toc.getByRole("link", {
				name: "一个途中片刻：让长一点的标题也能完整读完",
				exact: true,
			});
			const deep = toc.getByRole("link", { name: "更近一点", exact: true });
			await expect(
				toc.locator('li[data-heading-level="3"] > ol > li[data-heading-level="4"]'),
			).toHaveCount(1);
			const x = (link: typeof nested) => link.evaluate((el) => el.getBoundingClientRect().left);
			expect(await x(nested)).toBeGreaterThan(await x(parent));
			expect(await x(deep)).toBeGreaterThan(await x(nested));
			expect(await nested.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
			const anchor = toc.locator('a[href="#一点代码"]');
			await anchor.press("Enter");
			await expect(anchor).toHaveAttribute("aria-current", "location");
			await expect(toc.locator('[aria-current="location"]')).toHaveCount(1);
			if (width <= 800) {
				await expect(toc).not.toHaveAttribute("open");
				await expect(page.locator('[id="一点代码"]')).toBeFocused();
			}
			expect(
				await page.evaluate(() => {
					const heading = document.getElementById("一点代码");
					const header = document.getElementById("main-header");
					return (
						heading &&
						header &&
						heading.getBoundingClientRect().top >= header.getBoundingClientRect().bottom
					);
				}),
			).toBe(true);

			const photo = page.locator(".article-photo").first();
			await photo.focus();
			await photo.press("Enter");
			await expect(page.locator("#photo-viewer")).toBeVisible();
			await expect(page.locator(".viewer-image")).toHaveAttribute(
				"alt",
				"用于验证响应式尺寸的窗边插画",
			);
			await page.keyboard.press("Escape");
			await expect(page.locator("#photo-viewer")).not.toBeVisible();
			await expect(photo).toBeFocused();
			const linkedImage = page.locator('.article-content a[href="/zh/blogs/"] img');
			await expect(linkedImage).toHaveCount(1);
			await expect(page.locator(".article-content a .article-photo")).toHaveCount(0);

			const next = page.locator('.article-related a[href="/zh/blogs/verification-reading-next/"]');
			await expect(next).toBeVisible();
			await expect(page.locator(".article-end nav")).toHaveCount(1);
			await expect(page.locator('.article-related a[href*="draft"]')).toHaveCount(0);
			await expect(page.locator('.article-back[href="/zh/blogs/"]')).toHaveText("返回文章列表");
			await next.click();
			await expect(page).toHaveURL(/\/verification-reading-next\/$/);
			await expect(page.locator(`.article-related a[href="${article}"]`)).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
		});
	}
}

test("copying an article uses its stable permalink and announces success", async ({
	page,
	context,
}) => {
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto(`${article}#一点代码`);
	const copy = page.locator(".article-meta .copy-link");
	const expected = await copy.getAttribute("data-copy-url");
	const button = copy.getByRole("button");
	await expect(button).toHaveAccessibleName("复制链接");
	await button.click();
	await expect(button).toHaveAccessibleName("已复制");
	await expect(button).toHaveAttribute("data-copied", "true");
	await expect(button.locator(".copy-link__check")).toBeVisible();
	await expect(copy.getByRole("status")).toHaveText("链接已复制");
	await expect(copy.getByRole("status")).toHaveClass(/sr-only/);
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
	await expect(copy.locator("input")).not.toBeVisible();
	await expect(button).toHaveAccessibleName("复制链接");
	await expect(button).not.toHaveAttribute("data-copied");
	await expect(button.locator(".copy-link__check")).not.toBeVisible();
});

test("keyboard copying keeps focus while an asynchronous clipboard write finishes", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: () => new Promise<void>((resolve) => window.setTimeout(resolve, 100)) },
		});
	});
	await page.goto(article);
	const button = page.locator(".article-meta [data-copy-button]");
	await button.focus();
	await page.keyboard.press("Enter");
	await expect(button).toHaveAccessibleName("已复制");
	await expect(button).toBeFocused();
	await expect(button).not.toHaveAttribute("aria-busy");
	await expect(button).not.toHaveAttribute("aria-disabled");
});

for (const width of [320, 1440]) {
	const lang = width === 320 ? "zh" : "en";
	test(`a multi-series article ends with at most two unique related titles at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(`/${lang}/blogs/AboutEras/`);
		const end = page.locator(".article-end");
		const related = end.locator(".article-related");
		const seriesLinks = page.locator('#blog-hero a[href*="?series="]');
		await expect(seriesLinks).toHaveCount(2);
		expect(
			await seriesLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
		).toEqual([`/${lang}/blogs/?series=nexus-codex`, `/${lang}/blogs/?series=era-memoirs`]);
		await expect(end.locator("nav")).toHaveCount(1);
		await expect(related.locator("a")).toHaveCount(1);
		const hrefs = await related
			.locator("a")
			.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
		expect(hrefs).toEqual([`/${lang}/blogs/WoodenEra-01/`]);
		expect(hrefs.length).toBeLessThanOrEqual(2);
		expect(new Set(hrefs).size).toBe(hrefs.length);
		await expect(end.locator('a[href*="?series="]')).toHaveCount(0);
		await expect(end).not.toContainText(/上一篇|下一篇|回到系列|Previous|Next|Back to series/);
		await expect(
			end.getByRole("link", { name: lang === "zh" ? "返回文章列表" : "All articles", exact: true }),
		).toHaveAttribute("href", `/${lang}/blogs/`);
		await expect(end.locator(".copy-link")).toHaveCount(0);
		await expect(page.locator(".article-meta .copy-link")).toHaveCount(1);
		const longTitle = related.locator("a > span:first-child").first();
		await longTitle.evaluate((el) => {
			el.textContent =
				"这是一篇标题很长也应该完整显示的相关文章，继续阅读时无需猜测被截断的内容。".repeat(3);
		});
		expect(
			await longTitle.evaluate(
				(el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight,
			),
		).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
	});
}

for (const reason of ["denied", "unavailable"]) {
	test(`copying offers a selectable address when clipboard is ${reason}`, async ({ page }) => {
		await page.setViewportSize({ width: reason === "denied" ? 320 : 1440, height: 900 });
		await page.addInitScript((mode) => {
			Object.defineProperty(navigator, "clipboard", {
				configurable: true,
				value:
					mode === "unavailable"
						? undefined
						: {
								writeText: () => Promise.reject(new DOMException("Not allowed", "NotAllowedError")),
							},
			});
		}, reason);
		await page.goto("/en/blogs/verification-reading/");
		const copy = page.locator(".article-meta .copy-link");
		await copy.getByRole("button", { name: "Copy link" }).click();
		const address = copy.getByRole("textbox", { name: "Link address" });
		await expect(address).toBeVisible();
		await expect(address).toBeFocused();
		await expect(copy.getByRole("status")).toHaveText("Select the address below to copy it.");
		await expect(copy.getByRole("status")).not.toHaveClass(/sr-only/);
		expect(
			await address.evaluate(
				(input: HTMLInputElement) => (input.selectionEnd ?? 0) - (input.selectionStart ?? 0),
			),
		).toBe((await address.inputValue()).length);
		await expect(copy.getByRole("button")).toBeEnabled();
		expect(
			await page.locator(".article-meta").evaluate((el) => el.scrollWidth <= el.clientWidth),
		).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		const actions = await page.locator(".article-meta__actions").boundingBox();
		const details = await page.locator(".article-meta__details").boundingBox();
		if (!actions || !details) throw new Error("Missing article metadata fallback");
		expect(actions.y).toBeGreaterThanOrEqual(details.y + details.height);
	});
}

test("an article image can recover from a load failure", async ({ page }) => {
	await page.route("**/defaults/social-card.svg", (route) => route.abort());
	await page.goto(article);
	await page.locator(".article-photo").first().click();
	await expect(page.locator(".viewer-error")).toBeVisible();
	await page.unroute("**/defaults/social-card.svg");
	await page.getByRole("button", { name: "重试", exact: true }).click();
	await expect(page.locator(".viewer-error")).not.toBeVisible();
	await expect
		.poll(() =>
			page
				.locator(".viewer-image")
				.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
		)
		.toBe(true);
});

for (const width of [320, 1440]) {
	test(`reading, keyboard directory and share address work without JavaScript at ${width}px`, async ({
		browser,
	}) => {
		const context = await browser.newContext({
			javaScriptEnabled: false,
			viewport: { width, height: 900 },
		});
		const page = await context.newPage();
		try {
			await page.goto(`http://127.0.0.1:4323${article}`);
			await expect(page.locator(".article-content")).toBeVisible();
			await expect(page.locator(".article-photo")).toHaveCount(0);
			await page.locator(".article-toc summary").press("Enter");
			await expect(page.locator(".article-toc nav")).toBeVisible();
			await page
				.locator(".article-toc")
				.getByRole("link", { name: "一点代码", exact: true })
				.press("Enter");
			await expect(page.locator('[id="一点代码"]')).toBeInViewport();
			const copy = page.locator(".article-meta .copy-link");
			await expect(page.locator("[data-copy-url]")).toHaveCount(1);
			await expect(copy.locator("noscript a")).toHaveText(
				(await copy.getAttribute("data-copy-url")) || "",
			);
			await expect(copy.getByRole("button", { name: "复制链接" })).toHaveCount(0);
			expect(
				await page.locator(".article-meta").evaluate((el) => el.scrollWidth <= el.clientWidth),
			).toBe(true);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
		} finally {
			await context.close();
		}
	});
}

test("the directory adapts between a desktop sidebar and a mobile disclosure", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/en/blogs/verification-reading/");
	const toc = page.locator(".article-toc");
	await expect(toc).toHaveAttribute("open");
	await expect(toc.getByRole("navigation", { name: "Table of Contents" })).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(toc).not.toHaveAttribute("open");
	await expect(toc).toHaveCSS("position", "static");
	await toc.locator("summary").press("Space");
	await expect(toc).toHaveAttribute("open");
	await page.addStyleTag({ content: "html{font-size:200%}" });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(toc).toHaveAttribute("open");
	await expect(toc).toHaveCSS("position", "sticky");
});
