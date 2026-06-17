import { test, expect } from "@playwright/test";
import { TEST_USERS, signIn } from "./helpers/auth";

/**
 * Customer mua dịch vụ — TEST-PLAN §4.3
 * Yêu cầu: test number +84900000001 đã có fullName (Owner pre-seed) + đã chạy seed pricing.
 */
test.describe("Customer mua dịch vụ (TEST-PLAN §4.3)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, TEST_USERS.customer);
    await page.goto("/services");
    await expect(page.getByRole("heading", { name: /dịch vụ trực tuyến/i })).toBeVisible();
  });

  test("CB-01 · Mua vé tháng cho bản thân → toast success + mã đơn", async ({ page }) => {
    // Beneficiary mặc định = self, Audience mặc định = ADULT
    const passCards = page.locator("text=/^1 tháng$/i").locator("..").locator("..");
    await passCards.first().getByRole("button", { name: /^đăng ký$/i }).click();

    await expect(page.locator("text=/đặt.*thành công.*mã/i").first())
      .toBeVisible({ timeout: 15_000 });
  });

  test("CB-05 · Chọn bé → audience auto lock", async ({ page }) => {
    // Cần có ít nhất 1 bé. Skip nếu không có.
    const childButton = page.getByText(/con · \d+cm/i).first();
    const hasChild = await childButton.isVisible().catch(() => false);
    test.skip(!hasChild, "Customer chưa có bé — cần seed trước");

    await childButton.click();
    await expect(page.getByText(/tự chọn theo chiều cao/i)).toBeVisible();

    // Các nút audience disabled
    const adultBtn = page.getByRole("button", { name: /người lớn/i }).first();
    await expect(adultBtn).toBeDisabled();
  });

  test("CB-07 · Khách chưa đặt tên → block khi mua", async ({ page }) => {
    // Test này cần 1 user chưa có fullName. Khó setup từ test, đánh dấu skip.
    test.skip(true, "Manual test — cần xoá fullName trong Firestore trước");
  });
});
