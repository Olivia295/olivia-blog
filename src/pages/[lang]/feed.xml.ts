import type { APIRoute } from "astro";
import { feedResponse } from "@/data/feed";
import { isLang, languages } from "@/i18n/config";

export function getStaticPaths() {
	return languages.map((lang) => ({ params: { lang } }));
}
export const GET: APIRoute = ({ params }) =>
	isLang(params.lang)
		? feedResponse("all", params.lang)
		: new Response("Not found", { status: 404 });
