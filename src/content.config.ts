import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

function removeDupsAndLowerCase(array: string[]) {
	return [...new Set(array.map((str) => str.toLowerCase()))];
}

const titleSchema = z.string().max(60);

const baseSchema = z.object({
	title: titleSchema,
});

const post = defineCollection({
	loader: glob({ base: "./src/content/post", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		baseSchema.extend({
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
			/**
			 * Post-scoped music player (not global).
			 * - true: full playlist from music.json
			 * - { id }: one catalog track (id in music.json)
			 * - { src, title?, artist? }: one-off external URL
			 * - array: several of the above
			 * - false / omit: no player
			 */
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

const note = defineCollection({
	loader: glob({ base: "./src/content/note", pattern: "**/*.{md,mdx}" }),
	schema: baseSchema.extend({
		description: z.string().optional(),
		draft: z.boolean().default(false),
		publishDate: z.iso
			.datetime({ offset: true }) // Ensures ISO 8601 format with offsets allowed (e.g. "2024-01-01T00:00:00Z" and "2024-01-01T00:00:00+02:00")
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

export const collections = { post, note, tag };
