import { test, expect, BrowserContext } from "@playwright/test";
import { TEST_USERS, signIn } from "./helpers/auth";

/**
 * Owner sửa giá realtime — TEST-PLAN OW-02 + CB-03
 * Yêu cầu: TEST_USERS.staff đã được Owner gán role OWNER hoặc RECEPTIONIST.
 *          (Cho test này cần OWNER vì RECEPTIONIST không sửa được giá.)
 *
 * Lưu ý: Vì test thực sẽ sửa pricing trên Firestore prod, hãy chạy với cờ
 *   E2E_DESTRUCTIVE=1 npm run test:e2e -- admin-pricing
 * và đảm bảo có cron rollback hoặc test trên staging.
 */
test.describe("Pricing realtime (TEST-PLAN OW-02 + CB-03)", () => {
  test.skip(
    !process.env.E2E_DESTRUCTIVE,
    "Test này thay đổi giá thật — chỉ chạy khi E2E_DESTRUCTIVE=1",
  );

  test("OW-02 · Owner đổi giá → khách thấy ngay realtime", async ({ browser }) => {
    // 2 context song song: owner + customer ẩn danh
    const ownerCtx = await browser.newContext();
    const customerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const customerPage = await customerCtx.newPage();

    try {
      // 1. Customer xem giá hiện tại
      await customerPage.goto("/services");
      const oldPriceText = await customerPage
        .locator("text=/^1 tháng$/i").locator("..").locator("..")
        .locator("text=/₫/").first().innerText();
      const oldPrice = Number(oldPriceText.replace(/\D/g, ""));

      // 2. Owner đăng nhập + đổi giá
      await signIn(ownerPage, TEST_USERS.staff);
      await ownerPage.goto("/admin/products");
      const adultMonthInput = ownerPage.locator("table tbody tr").nth(2)
        .locator("input[type=number]").first();
      const newPrice = oldPrice + 50_000;
      await adultMonthInput.fill(String(newPrice));
      await ownerPage.getByRole("button", { name: /lưu thay đổi/i }).click();
      await expect(ownerPage.locator("text=/đã lưu/i")).toBeVisible({ timeout: 10_000 });

      // 3. Customer thấy giá mới trong < 5s (realtime onSnapshot)
      await expect(async () => {
        const cur = await customerPage
          .locator("text=/^1 tháng$/i").locator("..").locator("..")
          .locator("text=/₫/").first().innerText();
        expect(Number(cur.replace(/\D/g, ""))).toBeGreaterThan(oldPrice);
      }).toPass({ timeout: 8_000 });

      // 4. Cleanup: trả giá về cũ
      await adultMonthInput.fill(String(oldPrice));
      await ownerPage.getByRole("button", { name: /lưu thay đổi/i }).click();
    } finally {
      await closeQuietly(ownerCtx);
      await closeQuietly(customerCtx);
    }
  });
});

async function closeQuietly(ctx: BrowserContext) {
  try { await ctx.close(); } catch {}
}
