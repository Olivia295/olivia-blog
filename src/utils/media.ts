/** Resolve a media path against PUBLIC_MEDIA_BASE_URL, or return absolute URLs as-is. */
export function resolveMediaUrl(pathOrUrl: string): string {
	if (/^https?:\/\//i.test(pathOrUrl)) {
		return pathOrUrl;
	}

	const base = (import.meta.env.PUBLIC_MEDIA_BASE_URL as string | undefined)?.replace(/\/$/, "");
	const path = pathOrUrl.replace(/^\//, "");

	if (!base) {
		return pathOrUrl;
	}

	return `${base}/${path}`;
}
