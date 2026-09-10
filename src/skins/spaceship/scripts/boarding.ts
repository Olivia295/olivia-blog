export function setupBoarding(signal: AbortSignal) {
	const dialog = document.querySelector<HTMLDialogElement>("#boarding");
	if (!dialog) return;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	let timer: ReturnType<typeof setTimeout> | undefined;
	let returnFocus: HTMLElement | null = null;
	const finish = () => {
		clearTimeout(timer);
		if (dialog.open) dialog.close();
		delete document.body.dataset.boarding;
	};
	const start = (replay = false, opener: HTMLElement | null = null) => {
		if (signal.aborted || document.documentElement.dataset.skin !== "spaceship") return;
		try {
			localStorage.setItem("boarding-seen", "1");
		} catch {}
		if (reduced.matches || dialog.open) return;
		if (!replay && document.documentElement.dataset.spaceMotion === "paused") return;
		if (replay) window.scrollTo({ top: 0, behavior: "instant" });
		returnFocus = opener;
		dialog.showModal();
		document.body.dataset.boarding = "active";
		timer = setTimeout(finish, 2600);
	};
	dialog.addEventListener(
		"close",
		() => {
			clearTimeout(timer);
			delete document.body.dataset.boarding;
			if (!signal.aborted)
				(returnFocus ?? document.querySelector<HTMLElement>("#main"))?.focus({
					preventScroll: true,
				});
		},
		{ signal },
	);
	dialog.addEventListener("cancel", () => clearTimeout(timer), { signal });
	dialog.querySelector("#skip-boarding")?.addEventListener("click", finish, { signal });
	for (const replay of document.querySelectorAll<HTMLButtonElement>("[data-replay-boarding]")) {
		replay.hidden = false;
		replay.addEventListener("click", () => start(true, replay), { signal });
	}
	document.addEventListener(
		"cabin-motion-change",
		() => {
			if (document.documentElement.dataset.spaceMotion === "paused") finish();
		},
		{ signal },
	);
	reduced.addEventListener(
		"change",
		() => {
			if (reduced.matches) finish();
		},
		{ signal },
	);
	signal.addEventListener(
		"abort",
		() => {
			finish();
			for (const replay of document.querySelectorAll<HTMLButtonElement>("[data-replay-boarding]"))
				replay.hidden = true;
		},
		{ once: true },
	);
	let seen = false;
	try {
		seen = localStorage.getItem("boarding-seen") === "1";
	} catch {}
	const navigation = performance.getEntriesByType("navigation")[0] as
		| PerformanceNavigationTiming
		| undefined;
	const address = new URL(location.href);
	if (address.searchParams.get("boarding") === "replay") {
		address.searchParams.delete("boarding");
		history.replaceState(history.state, "", address);
		start(true);
	} else if (!seen && navigation?.type !== "back_forward" && !location.hash) start();
}
