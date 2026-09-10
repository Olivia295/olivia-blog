import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

/** Keep wide code and tables keyboard-scrollable, including without client JavaScript. */
export function makeOverflowReadable(tree: Root | Element) {
	visit(tree, "element", (node) => {
		if (node.tagName === "pre" || node.tagName === "table") {
			node.properties.tabIndex = 0;
			node.properties.ariaLabel ??= node.tagName === "pre" ? "代码 / Code" : "表格 / Table";
		}
	});
}
export function rehypeReadableOverflow() {
	return makeOverflowReadable;
}
