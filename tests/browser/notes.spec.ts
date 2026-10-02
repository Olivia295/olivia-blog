import { expect, test } from "@playwright/test";
import { type DefaultTreeAdapterTypes, parse, serialize } from "parse5";

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem("boarding-seen", "1"));
	await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const skin of ["minimal", "spaceship"]) {
	for (const width of [320, 1440]) {
		const lang = width === 320 ? "zh" : "en";
		test(`one complete notes page with keyboard filters: ${skin}, ${lang}, ${width}px`, async ({
			page,
		}) => {
			await page.addInitScript((value) => localStorage.setItem("blog-skin", value), skin);
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`/${lang}/posts/`);
			const filters = page.locator("[data-note-filter]");
			await expect(filters).toHaveText(
				lang === "zh"
					? ["全部", "快录", "分享", "摘抄"]
					: ["All", "Quick note", "Share", "Excerpt"],
			);
			expect(await page.locator(".note-card").count()).toBeGreaterThanOrEqual(30);
			await expect(page.locator("#post-verification-archive-0")).toBeVisible();
			const fullText = await page.locator("#post-verification-note-0 .note-card__body").innerText();
			expect(fullText.match(/完整内容仍然可以打开阅读/g)).toHaveLength(8);
			expect(fullText).not.toContain("export const");
			await expect(page.locator(".note-card__permalink,.post-tabs a")).toHaveCount(0);
			await expect(page.locator(".note-card[data-pagefind-ignore]")).toHaveCount(0);
			await expect(page.locator("#post-verification-archive-0")).toHaveAttribute(
				"data-pagefind-body",
				"",
			);
			await expect(page.locator('[data-rss-kind="posts"]')).toHaveAttribute(
				"href",
				`/${lang}/subscribe/#feed-posts`,
			);
			const shareCount = await page.locator('[data-note-types~="rec"]').count();
			const excerptCount = await page.locator('[data-note-types~="excerpt"]').count();
			expect(shareCount).toBeGreaterThanOrEqual(4);
			expect(excerptCount).toBeGreaterThan(0);

			const share = page.locator('[data-note-filter="rec"]');
			await share.focus();
			await page.keyboard.press("Space");
			await expect(share).toBeFocused();
			await expect(share).toHaveAttribute("aria-pressed", "true");
			await expect(page).toHaveURL(new RegExp(`/${lang}/posts/\\?type=rec$`));
			await expect(page.locator("#post-verification-music")).toBeVisible();
			await expect(page.locator("#post-verification-note-0")).toBeHidden();
			await expect(page.locator("[data-note-types]:not([hidden])")).toHaveCount(shareCount);
			await page.reload();
			await expect(share).toHaveAttribute("aria-pressed", "true");
			await expect(page.locator("#post-verification-note-0")).toBeHidden();

			const excerpt = page.locator('[data-note-filter="excerpt"]');
			await excerpt.focus();
			await page.keyboard.press("Enter");
			await expect(excerpt).toHaveAttribute("aria-pressed", "true");
			await expect(page.locator("[data-notes-empty]")).toBeHidden();
			await expect(page.locator("#note-feed")).toBeVisible();
			await expect(page.locator("#post-example-excerpt")).toBeVisible();
			await expect(page.locator("[data-note-types]:not([hidden])")).toHaveCount(excerptCount);
			await expect(filters).toHaveCount(4);
			await expect(page.locator("[data-note-status]")).toHaveText(
				lang === "zh" ? `${excerptCount} 条随记` : `${excerptCount} notes`,
			);

			await page.locator('[data-note-filter="all"]').click();
			await expect(page).toHaveURL(new RegExp(`/${lang}/posts/$`));
			await expect(page.locator("#post-verification-archive-0")).toBeVisible();
			await expect(page.locator("[data-notes-empty]")).toBeHidden();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
				true,
			);
			for (const button of await filters.all()) {
				expect(
					await button.evaluate((el) => el.getBoundingClientRect().height),
				).toBeGreaterThanOrEqual(44);
			}
		});
	}
}

test("an empty category explains its state and lets readers return to all notes", async ({
	page,
}) => {
	await page.route("**/zh/posts/", async (route) => {
		const response = await route.fetch();
		const document = parse(await response.text());
		const removeExcerptType = (node: DefaultTreeAdapterTypes.Node) => {
			if ("attrs" in node) {
				const types = node.attrs.find((attribute) => attribute.name === "data-note-types");
				if (types)
					types.value = types.value
						.split(/\s+/)
						.filter((type) => type !== "excerpt")
						.join(" ");
			}
			if ("childNodes" in node) node.childNodes.forEach(removeExcerptType);
		};
		removeExcerptType(document);
		await route.fulfill({ response, body: serialize(document) });
	});
	await page.goto("/zh/posts/");
	const excerpt = page.locator('[data-note-filter="excerpt"]');
	await excerpt.click();
	await expect(excerpt).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("[data-note-filter]")).toHaveCount(4);
	await expect(page.locator("[data-notes-empty]")).toBeVisible();
	await expect(page.locator("[data-note-status]")).toHaveText("0 条随记");
	await expect(page.locator("#note-feed")).toBeHidden();
	await page.locator('[data-note-filter="all"]').click();
	await expect(page.locator("[data-notes-empty]")).toBeHidden();
	await expect(page.locator("#note-feed")).toBeVisible();
	await expect(page.locator("#post-example-excerpt")).toBeVisible();
});

test("the three editable examples appear in their category with their complete writing", async ({
	page,
}) => {
	for (const example of [
		{
			type: "note",
			id: "example-quick-note",
		},
		{
			type: "rec",
			id: "example-share",
		},
		{
			type: "excerpt",
			id: "example-excerpt",
		},
	]) {
		await page.goto(`/zh/posts/?type=${example.type}`);
		const card = page.locator(`#post-${example.id}`);
		await expect(page.locator(`[data-note-filter="${example.type}"]`)).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await expect(card).toBeVisible();
		await expect(card.locator(".note-card__title")).toHaveCount(0);
		const body = card.locator(".note-card__body");
		await expect(body).toContainText(/\S/);
		const ending = body.locator(":scope > :last-child");
		await ending.scrollIntoViewIfNeeded();
		await expect(ending).toBeInViewport();
		await expect(card.locator(".note-card__permalink")).toHaveCount(0);
	}
});

for (const width of [320, 390, 768, 1440]) {
	test(`minimal notes keep a shared reading rhythm at ${width}px`, async ({ page, baseURL }) => {
		if (!baseURL) throw new Error("Missing test server address");
		await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
		await page.setViewportSize({ width, height: 900 });
		// All fixture covers are local; the card remains usable without third-party requests.
		await page.route("**/*", (route) =>
			new URL(route.request().url()).origin === new URL(baseURL).origin
				? route.continue()
				: route.abort(),
		);
		await page.goto("/zh/posts/");
		await expect(page.locator("html")).toHaveAttribute("data-skin", "minimal");
		await expect(page.locator(".note-card__title")).toHaveCount(0);
		await expect(page.locator(".recommendation__label")).toHaveCount(0);
		await expect(page.locator("#note-feed")).not.toContainText("耳边的旋律");
		await expect(page.locator(".recommendation iframe")).toHaveCount(0);

		const types = [
			{ id: "verification-note-0", type: "note", label: "快录" },
			{ id: "verification-excerpt", type: "excerpt", label: "摘抄" },
			{ id: "verification-spotify-link", type: "rec", label: "分享" },
		];
		const paragraphStyles = [];
		for (const item of types) {
			const card = page.locator(`#post-${item.id}`);
			await expect(card.locator(`.note-tag--${item.type}`)).toHaveText(item.label);
			paragraphStyles.push(
				await card
					.locator(".note-card__body > p")
					.first()
					.evaluate((paragraph) => {
						const style = getComputedStyle(paragraph);
						return {
							fontFamily: style.fontFamily,
							fontSize: style.fontSize,
							fontWeight: style.fontWeight,
							lineHeight: style.lineHeight,
						};
					}),
			);
		}
		expect(paragraphStyles[1]).toEqual(paragraphStyles[0]);
		expect(paragraphStyles[2]).toEqual(paragraphStyles[0]);
		const paragraphStyle = paragraphStyles[0];
		if (!paragraphStyle) throw new Error("Missing note paragraph styles");
		expect(Number.parseFloat(paragraphStyle.fontSize)).toBeGreaterThanOrEqual(16);
		const quote = page.locator("#post-verification-excerpt blockquote");
		await expect(quote).toHaveText("把想留下的句子放在这里，让引用和自己的感想清楚分开。");
		await expect(quote).toHaveCSS("font-style", "normal");
		const quoteMarker = await quote.evaluate((el) => {
			const style = getComputedStyle(el, "::before");
			return { width: Number.parseFloat(style.width), background: style.backgroundColor };
		});
		expect(quoteMarker.width).toBeGreaterThan(0);
		expect(quoteMarker.background).not.toBe("rgba(0, 0, 0, 0)");
		await expect(page.locator("#post-verification-excerpt .note-card__body > p").last()).toHaveText(
			"这是引用之后的感想，继续使用普通正文的字体。",
		);

		for (const [id, cover] of [
			["verification-music", "/defaults/portrait.svg"],
			["verification-book", "/defaults/portrait.svg"],
			["verification-movie", "/defaults/portrait.svg"],
			["verification-spotify-link", "/defaults/icon.svg"],
		] as const) {
			const image = page.locator(`#post-${id} .recommendation__cover img`);
			await expect(image).toHaveAttribute("src", cover);
			await image.scrollIntoViewIfNeeded();
			await image.evaluate((el: HTMLImageElement) => el.decode());
			expect(await image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
		}
		const share = page.locator("#post-verification-spotify-link");
		const spotify = share.locator(".recommendation__link");
		await expect(spotify).toHaveAccessibleName("在 Spotify 收听");
		await expect(spotify).toContainText("Spotify");
		const spotifyIcon = spotify.locator('[data-icon="mdi:spotify"]');
		await expect(spotifyIcon).toBeVisible();
		await expect(spotifyIcon).toHaveAttribute("aria-hidden", "true");
		await expect(spotifyIcon).toHaveAttribute("focusable", "false");
		await expect(spotify.locator('[data-icon="mdi:rss"]')).toHaveCount(0);
		await expect(spotify).toHaveCSS("border-width", "0px");
		await expect(spotify).toHaveCSS("box-shadow", "none");
		await expect(spotify.locator(".action-label")).toHaveCSS("text-decoration-line", "none");
		expect(
			await spotify.evaluate((el) => el.getBoundingClientRect().height),
		).toBeGreaterThanOrEqual(44);
		const rss = page.locator(".page-header .rss-link");
		for (const property of ["font-family", "font-size", "font-weight"]) {
			await expect(spotify).toHaveCSS(
				property,
				await rss.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property),
			);
		}
		for (const link of await share.locator(".recommendation__cover,.recommendation__link").all()) {
			await expect(link).toHaveAttribute(
				"href",
				"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
			);
			await expect(link).toHaveAttribute("target", "_blank");
			await expect(link).toHaveAttribute("rel", /noopener/);
		}
		await expect(share.locator("iframe,audio")).toHaveCount(0);
		expect(
			await page
				.locator(".note-card")
				.evaluateAll((cards) => cards.every((card) => card.scrollWidth <= card.clientWidth)),
		).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
		if (width === 320) {
			const response = await page.request.get("/zh/posts/rss.xml");
			expect(response.ok()).toBe(true);
			const feedCovers = await page.evaluate(
				(xml) => {
					const parser = new DOMParser();
					const feed = parser.parseFromString(xml, "application/xml");
					return Array.from(feed.querySelectorAll("item"), (item) => {
						const content = item.getElementsByTagNameNS(
							"http://purl.org/rss/1.0/modules/content/",
							"encoded",
						)[0]?.textContent;
						return {
							link: item.querySelector("link")?.textContent,
							cover: parser.parseFromString(content || "", "text/html").querySelector("img")?.src,
						};
					});
				},
				await response.text(),
			);
			for (const id of ["music", "book", "movie", "spotify-link"]) {
				const item = feedCovers.find((entry) => entry.link?.endsWith(`#post-verification-${id}`));
				expect(item?.cover).toMatch(
					id === "spotify-link"
						? /^https?:\/\/[^/]+\/defaults\/icon\.svg$/
						: /^https?:\/\/[^/]+\/defaults\/portrait\.svg$/,
				);
			}
		}

		await page.goto("/zh/");
		for (const item of types) {
			const preview = page.locator(
				item.type === "rec"
					? ".note-preview:has(.note-tag--rec)"
					: `.note-preview:has(.preview-detail[href="/zh/posts/#post-${item.id}"])`,
			);
			await expect(preview).toBeVisible();
			await expect(preview.locator(`.note-tag--${item.type}`)).toHaveText(item.label);
			await expect(preview.locator(".note-card__title,.recommendation__label,iframe")).toHaveCount(
				0,
			);
		}
		const homeCover = page.locator(".recent-notes .recommendation__cover img");
		await expect(homeCover).toHaveAttribute("src", /^\/defaults\/(?:portrait|icon)\.svg$/);
		await homeCover.scrollIntoViewIfNeeded();
		await homeCover.evaluate((el: HTMLImageElement) => el.decode());
		await expect(page.locator(".recent-notes .recommendation__link")).toHaveAttribute(
			"target",
			"_blank",
		);
		await expect(
			page.locator('.recent-notes .recommendation__link [data-icon="mdi:spotify"]'),
		).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true,
		);
	});
}

test("a failed recommendation cover hides without losing the music title or Spotify link", async ({
	page,
}) => {
	await page.addInitScript(() => localStorage.setItem("blog-skin", "minimal"));
	await page.setViewportSize({ width: 320, height: 900 });
	await page.route("**/defaults/icon.svg", (route) => route.abort());
	await page.goto("/zh/posts/#post-verification-spotify-link");
	const card = page.locator("#post-verification-spotify-link");
	const cover = card.locator(".recommendation__cover");
	await expect(cover.locator("img")).toHaveAttribute("src", "/defaults/icon.svg");
	await expect(cover).toHaveAttribute("hidden", "");
	await expect(cover).toBeHidden();
	await expect(cover.locator("img")).toBeHidden();
	await expect(card.locator(".recommendation__title")).toHaveText("只有链接的音乐推荐");
	await expect(card.locator(".recommendation__title")).toBeVisible();
	const link = card.getByRole("link", { name: /在 Spotify 收听/ });
	await expect(link).toBeVisible();
	await expect(link).toHaveAttribute(
		"href",
		"https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
	);
	await expect(link).toHaveAttribute("target", "_blank");
	await expect(card.locator("iframe")).toHaveCount(0);
	expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("filter history and note anchors keep the target visible below the header", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/zh/posts/?type=rec#post-verification-archive-0");
	await expect(page).toHaveURL(/\/zh\/posts\/#post-verification-archive-0$/);
	await expect(page.locator('[data-note-filter="all"]')).toHaveAttribute("aria-pressed", "true");
	const target = page.locator("#post-verification-archive-0");
	await expect(target).toBeInViewport();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const note = document.getElementById("post-verification-archive-0");
				const header = document.getElementById("main-header");
				if (!note || !header) throw new Error("The target note or header is missing");
				return note.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
			}),
		)
		.toBeGreaterThanOrEqual(0);

	await page.locator('[data-note-filter="rec"]').click();
	await expect(page).toHaveURL(/\/zh\/posts\/\?type=rec$/);
	await page.locator('[data-note-filter="note"]').click();
	await expect(page.locator("#post-verification-music")).toBeHidden();
	await page.goBack();
	await expect(page.locator('[data-note-filter="rec"]')).toHaveAttribute("aria-pressed", "true");
	await expect(page.locator("#post-verification-music")).toBeVisible();
	await page.goForward();
	await expect(page.locator('[data-note-filter="note"]')).toHaveAttribute("aria-pressed", "true");
	await page.evaluate(() => {
		location.hash = "post-verification-music";
	});
	await expect(page).toHaveURL(/\/zh\/posts\/#post-verification-music$/);
	await expect(page.locator("#post-verification-music")).toBeInViewport();
	await expect(page.locator('[data-note-filter="all"]')).toHaveAttribute("aria-pressed", "true");
});

test("former entry, category and pagination URLs only redirect to the notes page", async ({
	page,
	request,
}) => {
	for (const [from, to] of [
		["/zh/posts/entry/verification-note-0/", "/zh/posts/#post-verification-note-0"],
		["/en/posts/entry/verification-archive-0/", "/en/posts/#post-verification-archive-0"],
		["/zh/posts/rec/", "/zh/posts/?type=rec"],
		["/zh/posts/excerpt/", "/zh/posts/?type=excerpt"],
		["/zh/posts/2/", "/zh/posts/"],
		["/zh/posts/note/2/", "/zh/posts/?type=note"],
	] as const) {
		const response = await request.get(from);
		const html = await response.text();
		// Static-host redirects are tiny refresh documents, never duplicate note content.
		expect(html).not.toContain('class="note-card');
		await page.goto(from);
		await expect
			.poll(() => {
				const url = new URL(page.url());
				return `${url.pathname}${url.search}${url.hash}`;
			})
			.toBe(to);
		await expect(page.locator("[data-note-filter]")).toHaveCount(4);
	}
	await page.goto("/zh/posts/verification-reading/");
	await expect(page).toHaveURL(/\/zh\/blogs\/verification-reading\/$/);
});

test("without JavaScript every note remains fully readable even with a filter query", async ({
	browser,
	baseURL,
}) => {
	if (!baseURL) throw new Error("Missing test server address");
	const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
	try {
		const page = await context.newPage();
		await page.goto("/zh/posts/?type=rec#post-verification-archive-0");
		await expect(page.locator("#post-verification-note-0")).toBeVisible();
		await expect(page.locator("#post-verification-music")).toBeVisible();
		await expect(page.locator("#post-verification-archive-0")).toBeInViewport();
		expect(await page.locator(".note-card").count()).toBeGreaterThanOrEqual(30);
		await expect(page.locator("[data-note-filter]:disabled")).toHaveCount(4);
		await expect(page.locator(".note-card__permalink")).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test("search finds older full note text on the canonical notes page", async ({ page }) => {
	await page.goto("/zh/");
	await page.locator("[data-open-modal]").click();
	await page.locator(".pagefind-ui__search-input").fill("归档定位验证");
	await expect(page.locator('.pagefind-ui__result-link[href="/zh/posts/"]')).toBeVisible();
	await expect(page.locator('.pagefind-ui__result-link[href*="/posts/entry/"]')).toHaveCount(0);
});
