import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: "only-on-failure",
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: [
    {
      command: "node apps/match/dist/index.js",
      url: "http://127.0.0.1:2567/health",
      reuseExistingServer: false,
    },
    {
      command: "node apps/web/.output/server/index.mjs",
      url: "http://127.0.0.1:3000",
      env: { HOST: "127.0.0.1", PORT: "3000" },
      reuseExistingServer: false,
    },
  ],
});
