import path from "node:path";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

function entryId(entry: string) {
	const parts = entry.replace(/\\/g, "/").split("/");
	const file = parts.at(-1) ?? entry;
	if (/^index\.(md|mdx)$/i.test(file) && parts.length >= 2) {
		return parts.at(-2) ?? file;
	}
	return path.basename(file).replace(/\.(md|mdx)$/i, "");
}

function removeDupsAndLowerCase(array: string[]) {
	return [...new Set(array.map((str) => str.toLowerCase()))];
}

const titleSchema = z.string().max(60);

const blog = defineCollection({
	loader: glob({
		base: "./src/content/blog",
		pattern: ["**/*.{md,mdx}", "!**/_*/*", "!**/_*/**"],
		generateId: ({ entry }) => entryId(entry),
	}),
	schema: ({ image }) =>
		z.object({
			title: titleSchema,
			description: z.string(),
			coverImage: z
				.object({
					alt: z.string(),
					src: image(),
				})
				.optional(),
			draft: z.boolean().default(false),
			ogImage: z.string().optional(),
			tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
			series: z.string().max(40).optional(),
			publishDate: z
				.string()
				.or(z.date())
				.transform((val) => new Date(val)),
			updatedDate: z
				.string()
				.optional()
				.transform((str) => (str ? new Date(str) : undefined)),
			pinned: z.boolean().default(false),
			music: z
				.union([
					z.boolean(),
					z
						.object({
							id: z.string().optional(),
							src: z.string().optional(),
							title: z.string().optional(),
							artist: z.string().optional(),
						})
						.refine((v) => Boolean(v.id || v.src), {
							message: "music needs `id` (from music.json) or `src` (URL)",
						}),
					z
						.array(
							z
								.object({
									id: z.string().optional(),
									src: z.string().optional(),
									title: z.string().optional(),
									artist: z.string().optional(),
								})
								.refine((v) => Boolean(v.id || v.src), {
									message: "each music item needs `id` or `src`",
								}),
						)
						.min(1),
				])
				.default(false),
		}),
});

const post = defineCollection({
	loader: glob({
		base: "./src/content/post",
		pattern: "**/*.{md,mdx}",
		generateId: ({ entry }) => entryId(entry),
	}),
	schema: z.object({
		title: titleSchema.optional(),
		description: z.string().optional(),
		draft: z.boolean().default(false),
		publishDate: z.iso
			.datetime({ offset: true })
			.transform((val) => new Date(val)),
	}),
});

const tag = defineCollection({
	loader: glob({ base: "./src/content/tag", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: titleSchema.optional(),
		description: z.string().optional(),
	}),
});

export const collections = { blog, post, tag };
