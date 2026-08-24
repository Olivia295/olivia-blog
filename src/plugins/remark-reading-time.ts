import { toString as mdastToString } from "mdast-util-to-string";
import getReadingTime from "reading-time";

export function remarkReadingTime() {
	// @ts-expect-error:next-line
	return (tree, { data }) => {
		const textOnPage = mdastToString(tree);
		const readingTime = getReadingTime(textOnPage);
		// Store minutes only; UI formats by locale (avoid hardcoded "X min read").
		data.astro.frontmatter.readingTimeMinutes = Math.max(1, Math.ceil(readingTime.minutes));
	};
}
