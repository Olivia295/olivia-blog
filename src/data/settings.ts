import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "astro/zod";
import { fallbackSkin, findSkin } from "../skins/registry.ts";

const localized = z.object({ zh: z.string(), en: z.string() });
const fact = z.object({ label: z.string(), value: z.string() });
const color = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex color");
const palette = z.object({ hull: color, surface: color, text: color, muted: color, accent: color });
const profileSchema = z.object({
	name: z.string(),
	role: localized,
	bio: z.object({ zh: z.array(z.string()), en: z.array(z.string()) }),
	portraitAlt: localized,
	facts: z.object({ zh: z.array(fact), en: z.array(fact) }),
	links: z.array(
		z.object({
			id: z.string(),
			label: z.string(),
			href: z.string().refine((v) => /^(https?:\/\/|mailto:)/.test(v), "Use https:// or mailto:"),
			icon: z.string().default("mdi:link-variant"),
		}),
	),
	portrait: z.string().optional(),
});
const settingsSchema = z.object({
	defaultSkin: z
		.string()
		.default(fallbackSkin)
		.refine((id) => !!findSkin(id), "Unknown defaultSkin; register the skin first"),
	title: z.string().min(1),
	shortName: z.string(),
	author: z.string().min(1),
	url: z.url(),
	description: z.string(),
	intro: localized,
	boarding: z.boolean(),
	indexable: z.boolean(),
	recentLimit: z.number().int().min(1).max(50),
	home: z
		.object({
			notes: z.number().int().min(1).max(20).default(3),
			articles: z.number().int().min(1).max(20).default(5),
			portraitAlt: localized.default({ zh: "", en: "" }),
		})
		.default({ notes: 3, articles: 5, portraitAlt: { zh: "", en: "" } }),
	scene: z.object({ motion: z.boolean().default(true) }).default({ motion: true }),
	sections: z.object({
		blogs: z.boolean(),
		posts: z.boolean(),
		gallery: z.boolean(),
		about: z.boolean(),
		hideEmpty: z.boolean(),
	}),
	colors: z.object({ light: palette, dark: palette }),
	content: z.object({
		directory: z.string(),
		autoDiscoverSibling: z.boolean(),
		legacy: z.boolean(),
	}),
	profile: profileSchema,
});
export type Settings = z.infer<typeof settingsSchema>;
export type ProfileCopy = z.infer<typeof profileSchema>;
export type ProfileLink = ProfileCopy["links"][number];
export type ProfileFact = ProfileCopy["facts"]["zh"][number];
function json(file: string): Record<string, unknown> {
	if (!existsSync(file)) return {};
	try {
		return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
	} catch {
		throw new Error(`Invalid JSON in ${file}`);
	}
}
function object(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Arrays replace (including []); records merge to preserve untranslated fields. */
export function mergeSettings(
	base: Record<string, unknown>,
	over: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...base };
	for (const [key, value] of Object.entries(over))
		result[key] = object(value) && object(result[key]) ? mergeSettings(result[key], value) : value;
	return result;
}
export function parseSettings(value: unknown): Settings {
	return settingsSchema.parse(value);
}
export function readSettings(root = process.cwd(), env: NodeJS.ProcessEnv = process.env): Settings {
	const neutral = json(path.join(root, "sample/site/site.json"));
	const state = json(path.join(root, ".content-state.json"));
	const isolated = env.CONTENT_MODE === "sample" || env.BARE === "1" || state.mode === "sample";
	let config = isolated
		? neutral
		: mergeSettings(neutral, json(path.join(root, "spaceship.config.json")));
	if (!isolated) {
		const overlay = json(path.join(root, "src/content/site/site.json"));
		config = mergeSettings(config, overlay);
		const legacyAbout = json(path.join(root, "src/content/site/about.json"));
		// Central profile fields take precedence over the earlier about.json format.
		config.profile = mergeSettings(
			mergeSettings(object(config.profile) ? config.profile : {}, legacyAbout),
			object(overlay.profile) ? overlay.profile : {},
		);
		const copy = json(path.join(root, "src/content/site/copy.json"));
		if (object(copy.home) && !overlay.intro)
			config.intro = mergeSettings(object(config.intro) ? config.intro : {}, copy.home);
		if (object(config.profile) && !object(overlay.profile) && !legacyAbout.name && overlay.author)
			config.profile.name = overlay.author;
	}
	return parseSettings(config);
}
export function isSampleContent(): boolean {
	return (
		process.env.CONTENT_MODE === "sample" ||
		json(path.join(process.cwd(), ".content-state.json")).mode === "sample"
	);
}
export const settings = readSettings();
