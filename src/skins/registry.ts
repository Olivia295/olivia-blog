import spaceship from "./spaceship/skin.ts";
import minimal from "./minimal/skin.ts";
import type { Skin } from "./types.ts";

/** Add a skin folder and register its metadata here. UI options and entry points follow its id. */
export const skins: Skin[] = [spaceship, minimal];
export const fallbackSkin = skins[0]!.id;
export const findSkin = (id: string) => skins.find((skin) => skin.id === id);

for (const skin of skins) {
	if (
		!/^[a-z][a-z0-9-]*$/.test(skin.id) ||
		skins.filter((item) => item.id === skin.id).length !== 1
	)
		throw new Error(`Skin ids must be unique folder names: ${skin.id}`);
}
