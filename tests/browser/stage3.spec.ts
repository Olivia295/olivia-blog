import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("first visit opens the cabin for 2–3 seconds and subsequent visits are immediate", async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.goto("/zh/", { waitUntil: "commit" });
	const start = Date.now();
	await expect(page.locator("#boarding")).toBeVisible();
	await expect(page.locator("#boarding")).not.toBeVisible({ timeout: 3500 });
	expect(Date.now() - start).toBeGreaterThanOrEqual(2000);
	expect(Date.now() - start).toBeLessThan(3500);
	await page.reload();
	await expect(page.locator("#boarding")).not.toBeVisible();
	await expect(page.locator("#home-name")).toBeVisible();
});
test("boarding can be skipped with keyboard and replayed", async ({ page }) => {
	await page.goto("/zh/");
	await expect(page.locator("#skip-boarding")).toBeFocused();
	await page.keyboard.press("Enter");
	await expect(page.locator("#boarding")).not.toBeVisible();
	await expect(page.locator("#main")).toBeFocused();
	await page.getByRole("button", { name: "↻ 重新登船" }).click();
	await expect(page.locator("#boarding")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.locator("#boarding")).not.toBeVisible();
	await expect(page.getByRole("button", { name: "↻ 重新登船" })).toBeFocused();
});
test("direct article, reduced motion and hash links open immediately", async ({ page }) => {
	await page.goto("/zh/blogs/verification-reading/");
	await expect(page.locator("#boarding")).toHaveCount(0);
	await expect(page.locator(".reading-body")).toBeVisible();
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/zh/");
	await expect(page.locator("#boarding")).not.toBeVisible();
	expect(await page.locator("#main").evaluate((el) => getComputedStyle(el).animationName)).toBe(
		"none",
	);
	await page.getByRole("button", { name: "↻ 重新登船" }).click();
	await expect(page.locator("#boarding")).not.toBeVisible();
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await page.evaluate(() => localStorage.removeItem("boarding-seen"));
	await page.goto("/zh/#recent-heading");
	await expect(page.locator("#boarding")).not.toBeVisible();
});
async function openAlbum(page: import("@playwright/test").Page) {
	await page.goto("/zh/gallery/");
	await page.locator("a.set").first().click();
	await expect(page.locator("[data-photo-src]").first()).toBeVisible();
}
test("album viewer supports keyboard, focus return, full-screen controls and accessibility", async ({
	page,
}) => {
	await openAlbum(page);
	const first = page.locator("[data-photo-src]").first();
	await first.focus();
	await page.keyboard.press("Enter");
	const dialog = page.getByRole("dialog", { name: "照片浏览器" });
	await expect(dialog).toBeVisible();
	await expect(page.locator(".viewer-image")).toHaveAttribute(
		"src",
		(await first.getAttribute("href")) ?? "missing-original",
	);
	await expect(page.locator(".viewer-counter")).toHaveText(/^1 \/ \d+$/);
	expect(
		await page.locator(".viewer-image").evaluate((el) => {
			const image = el.getBoundingClientRect();
			const parent = el.parentElement!.getBoundingClientRect();
			return (
				image.height <= parent.height &&
				image.width <= parent.width &&
				getComputedStyle(el).objectFit === "contain"
			);
		}),
	).toBe(true);
	await page.keyboard.press("ArrowRight");
	await expect(page.locator(".viewer-counter")).toHaveText(/^2 \/ \d+$/);
	await page.keyboard.press("ArrowLeft");
	await expect(page.locator(".viewer-counter")).toHaveText(/^1 \/ \d+$/);
	await page.getByRole("button", { name: "全屏", exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement))
		.toBe(true);
	await page.getByRole("button", { name: "全屏", exact: true }).click();
	const result = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(result.violations).toEqual([]);
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(first).toBeFocused();
});
test("mobile swipes switch photos and the visible close button restores the album", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await openAlbum(page);
	await page.locator("[data-photo-src]").first().click();
	await page.locator(".viewer-image-wrap").evaluate((el) => {
		const first = new Touch({ identifier: 1, target: el, clientX: 280, clientY: 300 });
		el.dispatchEvent(
			new TouchEvent("touchstart", { touches: [first], changedTouches: [first], bubbles: true }),
		);
		const end = new Touch({ identifier: 1, target: el, clientX: 90, clientY: 305 });
		el.dispatchEvent(
			new TouchEvent("touchend", { touches: [], changedTouches: [end], bubbles: true }),
		);
	});
	await expect(page.locator(".viewer-counter")).toHaveText(/^2 \/ \d+$/);
	await page.getByRole("button", { name: "关闭预览" }).click();
	await expect(page.locator("#photo-viewer")).not.toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("failed images have recovery and notes use accessible photo controls", async ({ page }) => {
	await page.goto("/zh/posts/");
	await expect(page.locator(".note-photo").first()).toHaveAccessibleName(/照片/);
	await page.locator(".note-photo").first().click();
	await expect(page.locator("#photo-viewer")).toBeVisible();
	await page.getByRole("button", { name: "关闭预览" }).click();
	await openAlbum(page);
	await page.route("**/gallery/**/*.{jpg,jpeg,png,webp}", (route) => route.abort());
	await page
		.locator("[data-photo-src]")
		.first()
		.evaluate((el) => ((el as HTMLElement).dataset.photoSrc = "/gallery/missing-test.jpg"));
	await page.locator("[data-photo-src]").first().click();
	await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "打开原图" })).toHaveAttribute(
		"href",
		"/gallery/missing-test.jpg",
	);
	await page.getByRole("button", { name: "关闭预览" }).click();
});
test("music stays silent through navigation and after the boarding duration", async ({ page }) => {
	await page.goto("/zh/", { waitUntil: "commit" });
	await expect(page.locator("#home-name")).toBeVisible();
	await expect(page.locator("#boarding")).not.toBeVisible({ timeout: 4000 });
	const audio = page.locator("audio");
	expect(
		await audio.evaluateAll((nodes) =>
			nodes.every((node) => node instanceof HTMLAudioElement && node.paused && !node.autoplay),
		),
	).toBe(true);
	await page.goto("/zh/blogs/verification-reading/");
	await expect(page.locator("audio")).toHaveCount(1);
	await page.waitForTimeout(5200); // Verify the former five-second autoplay behavior cannot return.
	expect(
		await page
			.locator("audio")
			.evaluateAll((nodes) =>
				nodes.every((node) => node instanceof HTMLAudioElement && node.paused && !node.autoplay),
			),
	).toBe(true);
});

test("a slow ship becomes visible within the first ten seconds", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.goto("/zh/");
	const scene = page.locator(".hangar-traffic");
	await expect(scene).toHaveAttribute("data-space-active", "true");
	await expect
		.poll(
			() =>
				scene
					.locator(".passing-ship")
					.first()
					.evaluate((el) => {
						const ship = el.getBoundingClientRect();
						const window = el.parentElement!.getBoundingClientRect();
						return (
							Number(getComputedStyle(el).opacity) > 0.1 &&
							ship.right > window.left &&
							ship.left < window.right
						);
					}),
			{ timeout: 10_000, intervals: [300] },
		)
		.toBe(true);
	const duration = await scene
		.locator(".passing-ship")
		.first()
		.evaluate((el) => Number.parseFloat(getComputedStyle(el).animationDuration) * 0.17);
	expect(duration).toBeGreaterThanOrEqual(15);
	expect(duration).toBeLessThanOrEqual(30);
});
test("pause freezes actual scene animation and persists across pages and reloads", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.goto("/zh/");
	await page.locator("[data-toggle-space]").click();
	const ship = page.locator(".hangar-traffic .passing-ship").first();
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
	await ship.evaluate(async (el) => {
		await Promise.all(el.getAnimations().map((animation) => animation.ready));
	});
	const before = await ship.evaluate((el) => el.getAnimations()[0]!.currentTime);
	await page.waitForTimeout(250);
	expect(await ship.evaluate((el) => el.getAnimations()[0]!.currentTime)).toBe(before);
	await page.goto("/zh/blogs/verification-reading/");
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
	await page.reload();
	await expect(page.locator("[data-toggle-space]")).toHaveText(/恢复动效/);
	await page.locator("[data-toggle-space]").click();
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "running");
	await expect(page.locator(".surround-window .space-scene").first()).toHaveAttribute(
		"data-space-active",
		"true",
	);
});
test("offscreen and background scenes stop; reduced motion takes priority", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.goto("/zh/");
	const scene = page.locator(".hangar-traffic");
	await expect(scene).toHaveAttribute("data-space-active", "true");
	await page.locator(".home-cabin-controls").scrollIntoViewIfNeeded();
	await expect(scene).toHaveAttribute("data-space-active", "false");
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
	await expect(scene).toHaveAttribute("data-space-active", "true");
	// Exercise the browser lifecycle handler deterministically; offscreen observation above is real.
	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await expect(scene).toHaveAttribute("data-space-active", "false");
	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await expect(scene).toHaveAttribute("data-space-active", "true");
	await page.emulateMedia({ reducedMotion: "reduce" });
	await expect(scene).toHaveAttribute("data-space-active", "false");
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "reduced");
	expect(
		await scene
			.locator(".passing-ship")
			.first()
			.evaluate((el) => el.getAnimations().length),
	).toBe(0);
	await expect(page.locator("[data-toggle-space]")).toBeDisabled();
});
test("navigation softly masks only the approaching hero edge and remains usable", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.goto("/zh/");
	await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
	const hero = page.locator("#main");
	await expect(hero).toHaveAttribute("data-header-overlap", "true");
	expect(await hero.evaluate((el) => getComputedStyle(el).maskImage)).toContain("linear-gradient");
	expect(await page.locator(".foyer-copy").evaluate((el) => getComputedStyle(el).filter)).toBe(
		"none",
	);
	const header = await page.locator("#main-header").boundingBox();
	expect(header!.y).toBe(8);
	await page.screenshot({ path: "artifacts/foundation/header-scroll.png" });
	await page.getByRole("navigation").getByRole("link", { name: "文章", exact: true }).click();
	await expect(page).toHaveURL("/zh/blogs/");
});
test("floating controls support keyboard and replay is only at the home bottom", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.goto("/zh/blogs/verification-reading/");
	await expect(
		page.locator("[data-replay-home], [data-replay-boarding], .cabin-console"),
	).toHaveCount(0);
	const toggle = page.locator("[data-toggle-space]");
	await toggle.focus();
	await page.keyboard.press("Enter");
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
	await expect(toggle).toBeFocused();
	const scan = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(scan.violations).toEqual([]);
	await page.goto("/zh/");
	const replay = page.locator(".home-cabin-controls [data-replay-boarding]");
	await expect(page.locator("[data-replay-boarding]")).toHaveCount(1);
	await replay.click();
	await expect(page.locator("#boarding")).toBeVisible();
	await expect(toggle).not.toBeVisible();
	await page.keyboard.press("Escape");
	await expect(replay).toBeFocused();
	await expect(toggle).toBeVisible();
});
test("controls remain usable when storage is blocked", async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("blocked");
			},
		});
	});
	await page.goto("/en/");
	await page.locator("#skip-boarding").click();
	await page.locator("[data-toggle-space]").click();
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "paused");
	await page.locator("[data-toggle-space]").click();
	await expect(page.locator("html")).toHaveAttribute("data-space-motion", "running");
});
