/** `npm run dev:bare` — site chrome only, no writing or gallery. */
export function isBarePreview(): boolean {
	return process.env.BARE === "1";
}
