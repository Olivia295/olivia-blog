/** Undated albums remain explorable without presenting an invented update date. */
export function contentDate(value?: string | Date): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}
export function sortTimeline<T extends { date: Date | null; key: string }>(entries: T[]): T[] {
	return [...entries].sort((a, b) => {
		const left = a.date?.getTime() ?? Number.NEGATIVE_INFINITY;
		const right = b.date?.getTime() ?? Number.NEGATIVE_INFINITY;
		return left === right ? a.key.localeCompare(b.key) : right - left;
	});
}
