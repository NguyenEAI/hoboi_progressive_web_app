import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — Hồ Bơi Prosper Plaza
 *
 * Chạy: npm run test:e2e
 * UI mode: npm run test:e2e:ui
 *
 * Lưu ý môi trường máy local RAM thấp:
 *   - workers=1 để không OOM
 *   - dùng `npm run start` (production server) thay vì `npm run dev` (Webpack ngốn RAM)
 *   - DISABLE_PWA=1 + LOW_MEM=1 khi build trước
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  },

  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
    // Bật khi cần test desktop:
    // { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],

  // Tự động start dev server nếu chưa chạy. Nếu đã chạy localhost:3000 thì reuse.
  webServer: {
    command: process.env.E2E_USE_DEV
      ? "npm run dev"
      : "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
