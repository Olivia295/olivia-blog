import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const skin of ["minimal", "spaceship"]) {
	for (const width of [320, 390, 1440, 2194]) {
		test(`RSS precedes copyright in a single footer row in ${skin} at ${width}px`, async ({
			page,
		}) => {
			await page.addInitScript((value) => localStorage.setItem("blog-skin", value), skin);
			await page.setViewportSize({ width, height: 900 });
			for (const lang of ["zh", "en"]) {
				await page.goto(`/${lang}/`);
				const rss = page.locator(".site-footer .rss-link");
				await rss.scrollIntoViewIfNeeded();
				await expect(rss).toHaveAttribute("href", `/${lang}/subscribe/`);
				await expect(rss).toHaveAccessibleName(/RSS/);
				await expect(rss).toContainText(lang === "zh" ? "RSS 订阅" : "RSS");
				const icon = rss.locator('[data-icon="mdi:rss"]');
				await expect(icon).toBeVisible();
				await expect(icon).toHaveAttribute("aria-hidden", "true");
				await expect(icon).toHaveAttribute("focusable", "false");
				if (skin === "minimal") {
					await expect(rss).toHaveCSS("border-width", "0px");
					await expect(rss).toHaveCSS("box-shadow", "none");
					await expect(rss.locator(".action-label")).toHaveCSS("text-decoration-line", "none");
				}
				const linkBox = await rss.boundingBox();
				const copyright = await page.locator(".site-footer p").boundingBox();
				if (!linkBox || !copyright) throw new Error("Missing footer content");
				expect(linkBox.height).toBeGreaterThanOrEqual(44);
				expect(
					Math.abs(copyright.y + copyright.height / 2 - (linkBox.y + linkBox.height / 2)),
				).toBeLessThan(1);
				expect(linkBox.x + linkBox.width).toBeLessThan(copyright.x);
				expect(
					await page
						.locator(".site-footer p")
						.evaluate(
							(el) =>
								el.getBoundingClientRect().height <=
								Number.parseFloat(getComputedStyle(el).lineHeight) + 1,
						),
				).toBe(true);
				await rss.focus();
				await page.keyboard.press("Enter");
				await expect(page).toHaveURL(new RegExp(`/${lang}/subscribe/$`));
				await expect(page.locator(".subscription-steps li")).toHaveCount(3);
				await expect(page.locator(".subscription-steps")).toContainText(
					lang === "zh" ? "添加订阅" : "Add feed",
				);
				await expect(page.locator("#feed-all .subscription-heading")).toContainText(
					lang === "zh" ? "推荐" : "Recommended",
				);
				await expect(page.locator("#feed-posts h2")).toContainText(
					lang === "zh" ? "随记" : "Notes",
				);
				await expect(page.locator(".subscription-option")).toHaveCount(3);
				for (const [route, kind] of [
					["blogs", "blogs"],
					["posts", "posts"],
				]) {
					await page.goto(`/${lang}/${route}/`);
					const entry = page.locator(".page-header .rss-link");
					await expect(entry).toHaveAttribute("href", `/${lang}/subscribe/#feed-${kind}`);
					await expect(entry).toHaveAccessibleName(/RSS/);
					await expect(entry.locator('[data-icon="mdi:rss"]')).toBeVisible();
					expect(
						await entry.evaluate((el) => el.getBoundingClientRect().height),
					).toBeGreaterThanOrEqual(44);
					await entry.click();
					await expect(page.locator(`#feed-${kind}`)).toBeInViewport();
				}
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true,
				);
			}
		});
	}
}

test("subscription addresses remain selectable when clipboard access is unavailable", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: () => Promise.reject(new Error("Clipboard unavailable")) },
		});
	});
	await page.goto("/zh/subscribe/");
	const option = page.locator("#feed-all");
	const url = await option.locator(".subscription-address").getAttribute("href");
	if (!url) throw new Error("Missing subscription address");
	await option.getByRole("button", { name: "复制订阅地址" }).click();
	const input = option.getByRole("textbox", { name: "链接地址" });
	await expect(input).toBeVisible();
	await expect(input).toBeFocused();
	await expect(input).toHaveValue(url);
	await expect(option.getByRole("status")).toHaveText("无法自动复制，请选中下方地址复制。");
	await expect(option.getByRole("button", { name: "复制订阅地址" })).toBeEnabled();
});

for (const lang of ["zh", "en"]) {
	test(`copying a subscription confirms inside the button and restores its label in ${lang}`, async ({
		page,
		context,
	}) => {
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
		await page.goto(`/${lang}/subscribe/`);
		const copy = page.locator("#feed-all .copy-link");
		const button = copy.getByRole("button");
		const label = lang === "zh" ? "复制订阅地址" : "Copy feed address";
		await expect(button).toHaveAccessibleName(label);
		await expect(button).toHaveCSS("border-width", "0px");
		await expect(button).toHaveCSS("box-shadow", "none");
		expect(await button.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
			44,
		);
		await button.click();
		await expect(button).toHaveAccessibleName(lang === "zh" ? "已复制" : "Copied");
		await expect(button.locator(".copy-link__check")).toBeVisible();
		await expect(copy.getByRole("status")).toHaveClass(/sr-only/);
		expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
			await copy.getAttribute("data-copy-url"),
		);
		await expect(button).toHaveAccessibleName(label);
		await expect(button.locator(".copy-link__check")).not.toBeVisible();
	});
}
