import { z } from "astro/zod";
import { recommendationSchema } from "./recommendation.ts";

// z.object strips legacy title/description keys without rejecting older note files.
export const postSchema = z
	.object({
		tags: z
			.array(z.string())
			.default([])
			.transform((arr) => [...new Set(arr.map((tag) => tag.trim()).filter(Boolean))]),
		draft: z.boolean().default(false),
		publishDate: z.iso.datetime({ offset: true }).transform((val) => new Date(val)),
		recommendation: recommendationSchema.optional(),
	})
	.transform((data) => ({
		...data,
		tags: data.recommendation ? [...new Set([...data.tags, "rec"])] : data.tags,
	}));
