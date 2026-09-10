import { setupBoarding } from "./scripts/boarding";

/** Each activation owns its listeners, observers and dialogs; cleanup preserves saved preferences. */
export function activate() {
	const controller = new AbortController();
	const { signal } = controller;
	const root = document.documentElement;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	const enabled =
		document.querySelector<HTMLElement>(".ship-surround")?.dataset.spaceEnabled !== "false";
	const chinese = root.lang.startsWith("zh");
	let paused = false;
	try {
		paused = localStorage.getItem("spaceship-motion-paused") === "1";
	} catch {}
	const scenes = [...document.querySelectorAll<HTMLElement>(".space-scene")];
	const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-toggle-space]")];
	const consoles = [...document.querySelectorAll<HTMLElement>("[data-cabin-console]")];
	const visible = new Map<Element, boolean>();
	const refresh = () => {
		root.dataset.spaceMotion = !enabled
			? "disabled"
			: reduced.matches
				? "reduced"
				: paused
					? "paused"
					: "running";
		for (const scene of scenes)
			scene.dataset.spaceActive = String(
				enabled &&
					!reduced.matches &&
					!paused &&
					document.visibilityState === "visible" &&
					visible.get(scene) === true,
			);
		for (const button of buttons) {
			button.hidden = false;
			button.disabled = !enabled || reduced.matches;
			button.setAttribute("aria-pressed", String(paused || reduced.matches));
			button.querySelector("[data-space-label]")!.textContent = !enabled
				? chinese
					? "窗景动效已关闭"
					: "Window motion disabled"
				: reduced.matches
					? chinese
						? "系统已减少动画"
						: "Reduced motion enabled"
					: paused
						? chinese
							? "恢复动效"
							: "Resume motion"
						: chinese
							? "暂停动效"
							: "Pause motion";
			button.querySelector("[data-space-icon]")!.textContent =
				paused || reduced.matches ? "▷" : "Ⅱ";
		}
	};
	const visibility = new IntersectionObserver((entries) => {
		for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
		refresh();
	});
	const sizes = new ResizeObserver((entries) => {
		for (const entry of entries)
			(entry.target as HTMLElement).style.setProperty(
				"--scene-width",
				`${entry.contentRect.width}px`,
			);
	});
	for (const scene of scenes) {
		visibility.observe(scene);
		sizes.observe(scene);
	}
	for (const controls of consoles) controls.hidden = false;
	for (const button of buttons)
		button.addEventListener(
			"click",
			() => {
				if (!enabled || reduced.matches) return;
				paused = !paused;
				try {
					localStorage.setItem("spaceship-motion-paused", paused ? "1" : "0");
				} catch {}
				refresh();
				document.dispatchEvent(new CustomEvent("cabin-motion-change", { detail: { paused } }));
			},
			{ signal },
		);
	document.addEventListener("visibilitychange", refresh, { signal });
	window.addEventListener("pageshow", refresh, { signal });
	window.addEventListener(
		"storage",
		(event) => {
			if (event.key === "spaceship-motion-paused") {
				paused = event.newValue === "1";
				refresh();
			}
		},
		{ signal },
	);
	reduced.addEventListener("change", refresh, { signal });
	refresh();

	const content = document.querySelector<HTMLElement>(".site-main");
	const header = document.querySelector<HTMLElement>("#main-header");
	let frame = 0;
	let edgeObserver: ResizeObserver | undefined;
	if (content && header) {
		const updateEdge = () => {
			frame = 0;
			const rect = content.getBoundingClientRect();
			const overlap = Math.max(0, header.getBoundingClientRect().bottom - rect.top);
			const active = overlap > 0 && rect.bottom > 0;
			content.dataset.headerOverlap = String(active);
			content.style.setProperty("--content-hidden-edge", `${active ? overlap : 0}px`);
			content.style.setProperty("--content-soft-edge", `${active ? overlap + 44 : 0}px`);
		};
		const requestEdge = () => {
			if (!frame) frame = requestAnimationFrame(updateEdge);
		};
		window.addEventListener("scroll", requestEdge, { passive: true, signal });
		window.addEventListener("resize", requestEdge, { signal });
		edgeObserver = new ResizeObserver(requestEdge);
		edgeObserver.observe(header);
		updateEdge();
	}
	const transitions = document.createElement("style");
	const updateTransitions = () => {
		transitions.textContent = reduced.matches ? "" : "@view-transition { navigation: auto; }";
	};
	updateTransitions();
	document.head.appendChild(transitions);
	reduced.addEventListener("change", updateTransitions, { signal });
	setupBoarding(signal);
	return () => {
		controller.abort();
		visibility.disconnect();
		sizes.disconnect();
		edgeObserver?.disconnect();
		cancelAnimationFrame(frame);
		transitions.remove();
		for (const scene of scenes) {
			scene.dataset.spaceActive = "false";
			scene.style.removeProperty("--scene-width");
		}
		for (const button of buttons) button.hidden = true;
		for (const controls of consoles) controls.hidden = true;
		delete root.dataset.spaceMotion;
		if (content) {
			delete content.dataset.headerOverlap;
			content.style.removeProperty("--content-hidden-edge");
			content.style.removeProperty("--content-soft-edge");
		}
	};
}
