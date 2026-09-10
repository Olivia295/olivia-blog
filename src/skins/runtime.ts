type Behavior = { activate: () => () => void };
const behaviors = import.meta.glob<Behavior>("./*/behavior.ts");
let active: string | undefined;
let cleanup: (() => void) | undefined;
let revision = 0;

async function activate() {
	const id = document.documentElement.dataset.skin;
	if (id === active) return;
	active = id;
	const current = ++revision;
	cleanup?.();
	cleanup = undefined;
	const load = behaviors[`./${id}/behavior.ts`];
	if (load) {
		const behavior = await load();
		if (current === revision) cleanup = behavior.activate();
	}
}
document.addEventListener("skin-applied", () => void activate());
void activate();
