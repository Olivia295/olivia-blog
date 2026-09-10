import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
	process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(systemChrome) ? systemChrome : "");
export default defineConfig({
	testDir: "./tests/browser",
	timeout: 30_000,
	retries: 0,
	workers: 2,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:4323",
		launchOptions: executablePath ? { executablePath } : {},
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "node scripts/test-server.mjs",
		url: "http://127.0.0.1:4323",
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
