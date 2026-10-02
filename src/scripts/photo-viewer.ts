/** Native dialog supplies modal focus containment and Escape; links still work without JS. */
export function initPhotoViewer() {
	const dialog = document.querySelector<HTMLDialogElement>("#photo-viewer");
	if (!dialog) return;
	// Leave content links intact, including photos that intentionally lead to an album or article.
	document
		.querySelectorAll<HTMLImageElement>(".note-card__body img, .article-content img")
		.forEach((img) => {
			if (img.closest("a,button")) return;
			const button = document.createElement("button");
			button.type = "button";
			button.className = img.closest(".article-content") ? "article-photo" : "note-photo";
			button.dataset.photoSrc = img.currentSrc || img.src;
			button.dataset.photoAlt = img.alt;
			button.setAttribute(
				"aria-label",
				`${dialog.dataset.fallback}: ${img.alt || (document.documentElement.lang.startsWith("zh") ? "查看大图" : "View photo")}`,
			);
			const media = img.closest("picture") || img;
			media.replaceWith(button);
			button.append(media);
		});
	const image = dialog.querySelector<HTMLImageElement>(".viewer-image")!;
	const counter = dialog.querySelector<HTMLElement>(".viewer-counter")!;
	const error = dialog.querySelector<HTMLElement>(".viewer-error")!;
	const original = dialog.querySelector<HTMLAnchorElement>("[data-viewer-original]")!;
	const fullscreen = dialog.querySelector<HTMLButtonElement>("[data-viewer-fullscreen]")!;
	const previous = dialog.querySelector<HTMLButtonElement>("[data-viewer-prev]")!;
	const next = dialog.querySelector<HTMLButtonElement>("[data-viewer-next]")!;
	let gallery: HTMLElement[] = [];
	let index = 0;
	let opener: HTMLElement | null = null;
	let ownsFullscreen = false;
	let touchStart: { x: number; y: number } | null = null;
	const show = () => {
		const item = gallery[index];
		if (!item) return;
		image.hidden = false;
		error.hidden = true;
		const thumbnail = item.querySelector<HTMLImageElement>("img");
		const src = item.classList.contains("article-photo")
			? thumbnail?.currentSrc || thumbnail?.src || item.dataset.photoSrc || ""
			: item.dataset.photoSrc || (item instanceof HTMLAnchorElement ? item.href : "");
		image.alt = item.dataset.photoAlt || `${dialog.dataset.fallback} ${index + 1}`;
		image.src = src;
		original.href = src;
		counter.textContent = `${index + 1} / ${gallery.length}`;
		previous.disabled = next.disabled = gallery.length < 2;
		if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
			image.animate(
				[
					{ opacity: 0.3, transform: "scale(.985)" },
					{ opacity: 1, transform: "scale(1)" },
				],
				{ duration: 180, easing: "ease-out" },
			);
	};
	const move = (delta: number) => {
		index = (index + delta + gallery.length) % gallery.length;
		show();
	};
	document.addEventListener("click", (event) => {
		const target =
			event.target instanceof Element
				? event.target.closest<HTMLElement>("[data-photo-src]")
				: null;
		if (
			!target ||
			(event instanceof MouseEvent &&
				(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey))
		)
			return;
		event.preventDefault();
		opener = target;
		const group =
			target.closest(".album-page,.note-card,.note-card--preview,.article-content") || document;
		gallery = [...group.querySelectorAll<HTMLElement>("[data-photo-src]")];
		index = gallery.indexOf(target);
		show();
		dialog.showModal();
		document.documentElement.classList.add("viewer-open");
	});
	previous.addEventListener("click", () => move(-1));
	next.addEventListener("click", () => move(1));
	dialog.querySelector("[data-viewer-close]")?.addEventListener("click", () => dialog.close());
	dialog.querySelector("[data-viewer-retry]")?.addEventListener("click", show);
	image.addEventListener("error", () => {
		image.hidden = true;
		error.hidden = false;
		error.querySelector("p")!.textContent = dialog.dataset.error || "";
	});
	dialog.addEventListener("keydown", (event) => {
		if (event.key === "ArrowRight") {
			event.preventDefault();
			move(1);
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			move(-1);
		}
		if (event.key === "Home") {
			event.preventDefault();
			index = 0;
			show();
		}
		if (event.key === "End") {
			event.preventDefault();
			index = gallery.length - 1;
			show();
		}
	});
	dialog.addEventListener("close", () => {
		document.documentElement.classList.remove("viewer-open");
		if (ownsFullscreen && document.fullscreenElement)
			void document.exitFullscreen().catch(() => {});
		ownsFullscreen = false;
		opener?.focus({ preventScroll: true });
	});
	const stage = dialog.querySelector<HTMLElement>(".viewer-image-wrap")!;
	stage.addEventListener(
		"touchstart",
		(event) => {
			const touch = event.touches[0];
			touchStart =
				event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
		},
		{ passive: true },
	);
	stage.addEventListener(
		"touchend",
		(event) => {
			const touch = event.changedTouches[0];
			if (!touchStart || !touch) return;
			const dx = touch.clientX - touchStart.x;
			const dy = touch.clientY - touchStart.y;
			if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
			touchStart = null;
		},
		{ passive: true },
	);
	stage.addEventListener(
		"touchcancel",
		() => {
			touchStart = null;
		},
		{ passive: true },
	);
	fullscreen.hidden = !document.fullscreenEnabled;
	fullscreen.addEventListener("click", () => {
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		else {
			ownsFullscreen = true;
			void document.documentElement.requestFullscreen().catch(() => {
				ownsFullscreen = false;
			});
		}
	});
}
