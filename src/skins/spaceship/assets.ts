import { existsSync } from "node:fs";
import path from "node:path";
import hangar from "./assets/hangar.webp";

const custom =
	process.env.BARE === "1"
		? undefined
		: ["webp", "jpg", "png", "avif"].find((ext) =>
				existsSync(path.join(process.cwd(), `public/site/hangar.${ext}`)),
			);
export const siteHangarSrc = custom ? `/site/hangar.${custom}` : hangar.src;
