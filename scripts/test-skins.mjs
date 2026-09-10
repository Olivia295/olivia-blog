import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

// Run against a local dev server or production preview; does not modify content or build fixtures.
const baseURL = process.env.SKIN_TEST_URL || "http://127.0.0.1:4325";
const output = process.env.SKIN_TEST_OUTPUT || "/tmp/olivia-skin-check";
mkdirSync(output, { recursive: true });
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
	headless: true,
	...(existsSync(chrome) ? { executablePath: chrome } : {}),
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("pageerror", (error) => errors.push(error.message));
const goto = async (url) => {
	const response = await page.goto(baseURL + url, { waitUntil: "networkidle" });
	assert.equal(response.status(), url === "/404.html" ? 404 : 200, url);
};
const current = () => page.getAttribute("html", "data-skin");
const choose = async (skin) => {
	await page.selectOption("#skin-select", skin);
	await page.waitForFunction(
		(id) =>
			document.documentElement.dataset.skin ===
			(id || document.documentElement.dataset.defaultSkin),
		skin,
	);
};
try {
	await goto("/zh/about/");
	assert.equal(await current(), "spaceship");
	assert.equal(await page.locator("#skin-select option").count(), 3);
	await choose("minimal");
	assert.equal(await page.evaluate(() => localStorage.getItem("blog-skin")), "minimal");
	await page.reload({ waitUntil: "networkidle" });
	assert.equal(await current(), "minimal");
	await goto("/en/about/");
	assert.equal(await current(), "minimal");
	await choose("");
	assert.equal(await current(), "spaceship");
	assert.equal(await page.evaluate(() => localStorage.getItem("blog-skin")), null);
	await page.locator("#skin-select").focus();
	await page.keyboard.press("m");
	await page.keyboard.press("Tab");
	assert.equal(await current(), "minimal");

	for (const skin of ["spaceship", "minimal"]) {
		await goto("/zh/about/");
		await choose(skin);
		await page.evaluate(() => {
			localStorage.setItem("boarding-seen", "1");
		});
		for (const [width, theme] of [
			[1440, "light"],
			[390, "dark"],
		]) {
			await page.setViewportSize({ width, height: 960 });
			await page.evaluate(
				(theme) => document.dispatchEvent(new CustomEvent("theme-change", { detail: { theme } })),
				theme,
			);
			for (const route of ["/zh/", "/zh/about/", "/zh/blogs/", "/zh/posts/", "/zh/gallery/"]) {
				await goto(route);
				assert.equal(await current(), skin);
				assert.equal(await page.getAttribute("html", "data-theme"), theme);
				assert.equal(
					await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
					false,
					`${skin} ${route} overflow`,
				);
				if (skin === "minimal") {
					assert.equal(await page.locator(".ship-surround").isVisible(), false);
					assert.equal(await page.locator("[data-toggle-space]").isVisible(), false);
					assert.equal(await page.locator("#boarding[open]").count(), 0);
					assert.equal(await page.locator('.space-scene[data-space-active="true"]').count(), 0);
				}
				if (route === "/zh/" || route === "/zh/about/")
					await page.screenshot({
						path: `${output}/${skin}-${width}-${theme}-${route === "/zh/" ? "home" : "about"}.png`,
						fullPage: true,
					});
			}
		}
	}

	await page.setViewportSize({ width: 1440, height: 960 });
	await goto("/zh/");
	const article = await page.locator(".article-preview h3 a").first().getAttribute("href");
	await goto(article);
	assert.equal(await page.locator(".reading-body").count(), 1);
	assert.ok((await page.locator(".reading-body").innerText()).trim().length > 0);
	await goto("/zh/");
	await page.locator("[data-photo-src]").first().click();
	assert.equal(await page.locator(".photo-viewer").isVisible(), true);
	await page.keyboard.press("Escape");
	assert.equal(await page.locator(".photo-viewer").isVisible(), false);
	await page.locator("site-search > button").click();
	assert.equal(await page.locator("site-search dialog").isVisible(), true);
	await page.keyboard.press("Escape");
	await page.evaluate(() => {
		localStorage.removeItem("boarding-seen");
	});
	await goto("/zh/?boarding=replay");
	assert.equal(await page.locator("#boarding[open]").count(), 0);
	assert.equal(await page.evaluate(() => localStorage.getItem("boarding-seen")), null);
	await page.evaluate(() =>
		document.dispatchEvent(new CustomEvent("skin-change", { detail: { skin: "spaceship" } })),
	);
	await page.waitForSelector("#boarding[open]");
	await page.evaluate(() =>
		document.dispatchEvent(new CustomEvent("skin-change", { detail: { skin: "minimal" } })),
	);
	await page.waitForFunction(() => !document.querySelector("#boarding")?.open);
	assert.equal(await page.getAttribute("body", "data-boarding"), null);
	assert.equal(await page.getAttribute("html", "data-space-motion"), null);
	await page.evaluate(() => localStorage.setItem("blog-skin", "retired-skin"));
	await goto("/zh/about/");
	assert.equal(await current(), "spaceship");
	await page.addInitScript(() =>
		Object.defineProperty(window, "localStorage", {
			get() {
				throw new Error("Storage unavailable");
			},
		}),
	);
	await goto("/zh/about/");
	await choose("minimal");
	assert.equal(await current(), "minimal");
	assert.deepEqual(errors, []);
	console.log(
		"PASS: settings UI, keyboard, persistence, languages, light/dark, desktop/mobile, core pages, photo/search dialogs, boarding cleanup and blocked storage.",
	);
	console.log(`Screenshots: ${output}`);
} finally {
	await browser.close();
}
