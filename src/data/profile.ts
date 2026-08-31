import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { siteConfig } from "@/site.config";
import { siteHeroSrc, siteLogoSrc } from "@/data/site-assets";

/**
 * Public fake defaults (this file is on GitHub).
 * Real About copy: private content repo `site/about.json`
 * synced to gitignored `src/content/site/about.json`.
 * Portrait: content `site/about.jpg` → `public/site/about.jpg`.
 */
const PORTRAIT_CANDIDATES = [
	"site/about.jpg",
	"site/about.jpeg",
	"site/about.png",
	"site/about.webp",
	"about.jpg",
	"about.png",
];

function firstPortrait(): string {
	const root = process.cwd();
	for (const rel of PORTRAIT_CANDIDATES) {
		if (existsSync(path.join(root, "public", rel))) {
			return `/${rel.replace(/^\/+/, "")}`;
		}
	}
	if (existsSync(path.join(root, "public", siteLogoSrc.replace(/^\//, "")))) {
		return siteLogoSrc;
	}
	return siteHeroSrc;
}

export type ProfileLink = {
	id: string;
	label: string;
	href: string;
	icon: string;
};

export type ProfileFact = {
	label: string;
	value: string;
};

export type ProfileCopy = {
	name: string;
	role: { zh: string; en: string };
	bio: { zh: string[]; en: string[] };
	portraitAlt: { zh: string; en: string };
	facts: { zh: ProfileFact[]; en: ProfileFact[] };
	links: ProfileLink[];
};

const defaults: ProfileCopy = {
	name: "Astro Cactus",
	role: {
		zh: "这是占位简介，不是真实资料。",
		en: "Placeholder bio — not real profile data.",
	},
	bio: {
		zh: [
			"仓库里的关于页只用假数据。真正的名字、简介和外链在私有内容库里。",
			"本地或部署时会从 olivia-blog-content/site/about.json 覆盖这里。",
		],
		en: [
			"The About page in this repo uses fake data only. Real copy lives in the private content repo.",
			"Local/dev deploys overlay olivia-blog-content/site/about.json on top of this file.",
		],
	},
	portraitAlt: {
		zh: "占位头像",
		en: "Placeholder portrait",
	},
	facts: {
		zh: [
			{ label: "坐标", value: "示例城市" },
			{ label: "现在", value: "占位一句" },
			{ label: "语言", value: "中文 / English" },
			{ label: "这个站", value: "文章 · 短记 · 画廊" },
		],
		en: [
			{ label: "Based", value: "Example City" },
			{ label: "Now", value: "A placeholder line" },
			{ label: "Languages", value: "中文 / English" },
			{ label: "Here", value: "Blogs · Posts · Gallery" },
		],
	},
	links: [
		{ id: "github", label: "GitHub", href: "https://github.com/", icon: "mdi:github" },
		{ id: "bilibili", label: "Bilibili", href: "https://space.bilibili.com/", icon: "mdi:television-play" },
		{ id: "email", label: "Email", href: "mailto:hello@example.com", icon: "mdi:email-outline" },
		{ id: "x", label: "X", href: "https://x.com/", icon: "mdi:twitter" },
	],
};

function loadPrivateAbout(): Partial<ProfileCopy> {
	const file = path.join(process.cwd(), "src/content/site/about.json");
	if (!existsSync(file)) return {};
	try {
		return JSON.parse(readFileSync(file, "utf8")) as Partial<ProfileCopy>;
	} catch {
		return {};
	}
}

function mergeProfile(base: ProfileCopy, over: Partial<ProfileCopy>): ProfileCopy {
	return {
		name: over.name ?? base.name,
		role: { ...base.role, ...over.role },
		bio: {
			zh: over.bio?.zh?.length ? over.bio.zh : base.bio.zh,
			en: over.bio?.en?.length ? over.bio.en : base.bio.en,
		},
		portraitAlt: { ...base.portraitAlt, ...over.portraitAlt },
		facts: {
			zh: over.facts?.zh?.length ? over.facts.zh : base.facts.zh,
			en: over.facts?.en?.length ? over.facts.en : base.facts.en,
		},
		links: over.links?.length ? over.links : base.links,
	};
}

const merged = mergeProfile(defaults, loadPrivateAbout());

export const profile = {
	...merged,
	portraitSrc: firstPortrait(),
};
