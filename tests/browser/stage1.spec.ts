import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
	for (const screen of ["index", "article"]) {
		test(`static ${screen} reflows at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 1000 });
			await page.goto(pathToFileURL(path.resolve(`docs/design/${screen}.html`)).href);
			await expect(page.locator("h1")).toBeVisible();
			await expect(page.getByRole("navigation")).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
			expect(
				await page
					.locator("nav a")
					.evaluateAll((links) => links.every((link) => link.getBoundingClientRect().height >= 44)),
			).toBe(true);
			if (screen === "index") {
				const order = await page
					.locator("main > section")
					.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
				expect(order[0]).toBeLessThan(order[1]!);
				expect(order[1]).toBeLessThan(order[2]!);
				await expect(page.locator(".note-entry")).toHaveCount(3);
				await expect(page.locator(".article-entry")).toHaveCount(5);
				const [notes, articles] = await page.locator(".recent-column").evaluateAll((nodes) =>
					nodes.map((node) => {
						const { x, y, height } = node.getBoundingClientRect();
						return { x, y, height };
					}),
				);
				if (width >= 860) {
					expect(notes!.x).toBeLessThan(articles!.x);
					expect(notes!.y).toBe(articles!.y);
					expect(notes!.height).toBe(articles!.height);
				} else {
					expect(notes!.y + notes!.height).toBeLessThan(articles!.y);
				}
				expect(
					await page
						.locator(".portrait img")
						.evaluate(
							(img: HTMLImageElement) =>
								img.complete &&
								img.naturalWidth > 0 &&
								Math.abs(img.width / img.height - img.naturalWidth / img.naturalHeight) < 0.01,
						),
				).toBe(true);
				expect(
					await page.locator(".window").evaluate((el) => getComputedStyle(el).backgroundImage),
				).toContain("hangar.webp");
			} else {
				await page.getByText("这篇文章的目录").click();
				await page.getByRole("link", { name: "慢一点，再慢一点" }).click();
				await expect(page).toHaveURL(/#slow$/);
				expect(
					await page.locator(".reading").evaluate((el) => el.getBoundingClientRect().width),
				).toBeLessThanOrEqual(880);
			}
			await mkdir("artifacts/design", { recursive: true });
			await page.screenshot({ path: `artifacts/design/${screen}-${width}.png`, fullPage: true });
		});
	}
}
