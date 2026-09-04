import type { Lang } from "@/i18n/config";

export type PostTagId = "excerpt" | "note" | "rec" | "other";
export const POST_TAB_IDS = ["all", "note", "rec", "excerpt"] as const;
export type PostTabId = (typeof POST_TAB_IDS)[number];

type TagDef = {
	id: Exclude<PostTagId, "other">;
	zh: string;
	en: string;
	aliases: string[];
};

const TAGS: TagDef[] = [
	{ id: "excerpt", zh: "摘抄", en: "Excerpt", aliases: ["摘抄", "excerpt", "quote"] },
	{ id: "note", zh: "随记", en: "Note", aliases: ["随记", "note", "jot", "memo"] },
	{ id: "rec", zh: "推荐", en: "Recommend", aliases: ["推荐", "recommend", "rec", "pick"] },
];

const byAlias = new Map<string, TagDef>();
for (const def of TAGS) {
	for (const alias of [def.id, def.zh, def.en, ...def.aliases]) {
		byAlias.set(alias.trim().toLowerCase(), def);
	}
}

export type ResolvedPostTag = {
	id: PostTagId;
	label: string;
};

export function resolvePostTag(raw: string, lang: Lang): ResolvedPostTag | undefined {
	const key = raw.trim();
	if (!key) return undefined;
	const def = byAlias.get(key.toLowerCase());
	if (!def) return { id: "other", label: key };
	return { id: def.id, label: lang === "en" ? def.en : def.zh };
}

export function postTabLabel(id: PostTabId, lang: Lang): string {
	if (id === "all") return lang === "en" ? "All" : "全部";
	const def = TAGS.find((tag) => tag.id === id);
	if (!def) return id;
	return lang === "en" ? def.en : def.zh;
}

export function postBelongsToTab(tags: string[] | undefined, tab: PostTabId): boolean {
	if (tab === "all") return true;
	return resolvePostTags(tags, "zh").some((tag) => tag.id === tab);
}

export function resolvePostTags(raw: string[] | undefined, lang: Lang): ResolvedPostTag[] {
	const seen = new Set<string>();
	const out: ResolvedPostTag[] = [];
	for (const item of raw ?? []) {
		const tag = resolvePostTag(item, lang);
		if (!tag) continue;
		const id = `${tag.id}:${tag.label}`;
		if (seen.has(id)) continue;
		seen.add(id);
		out.push(tag);
	}
	return out;
}
