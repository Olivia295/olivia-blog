import { menuLinkDefs } from "@/site.config";
import { getAllBlogs } from "./blog";
import { getPhotoAlbums } from "./gallery";
import { getAllPosts } from "./post";
import { settings } from "./settings";
export async function sectionLinks() {
	const sections = settings.sections;
	const counts = sections.hideEmpty
		? {
				blogs: (await getAllBlogs()).filter((e) => !e.data.draft).length,
				posts: (await getAllPosts()).filter((e) => !e.data.draft).length,
				gallery: getPhotoAlbums().length,
			}
		: null;
	return menuLinkDefs.filter((link) => {
		const key = link.path.replaceAll("/", "") as "blogs" | "posts" | "gallery" | "about";
		return sections[key] && (key === "about" || !counts || counts[key] > 0);
	});
}
