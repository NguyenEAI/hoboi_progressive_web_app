import { test, expect } from "@playwright/test";
import { TEST_USERS, signIn } from "./helpers/auth";

/**
 * Sign-in flow — TEST-PLAN §4.2
 * Cần test numbers đã setup trong Firebase Console.
 */
test.describe("Sign-in (TEST-PLAN §4.2)", () => {
  test("SI-01 · Customer login → vào /home", async ({ page }) => {
    await signIn(page, TEST_USERS.customer);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test("SI-02 · Login lại (đã có doc) → bỏ qua bước nhập tên", async ({ page }) => {
    // Lần đầu — nếu user chưa có fullName, sẽ hiện bước name. Skip ở đây vì
    // giả định Owner đã pre-seed fullName cho test numbers.
    await signIn(page, TEST_USERS.customer);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test("SI-05 · Resend OTP có countdown 60s", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/905 xxx xxx/i).fill(TEST_USERS.customer.phoneRaw);
    await page.getByRole("button", { name: /gửi mã otp/i }).click();
    await expect(page.getByText(/gửi lại sau \d+s/i)).toBeVisible({ timeout: 10_000 });
  });

  test("SI-06 · OTP sai → toast lỗi", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/905 xxx xxx/i).fill(TEST_USERS.customer.phoneRaw);
    await page.getByRole("button", { name: /gửi mã otp/i }).click();

    await expect(page.getByRole("heading", { name: /nhập mã otp/i })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("• • • • • •").fill("000000");
    await page.getByRole("button", { name: /xác nhận$/i }).click();

    // toast hoặc message lỗi xuất hiện
    await expect(page.locator("text=/invalid|sai|verification|fail/i").first())
      .toBeVisible({ timeout: 10_000 });
  });

  test("SI-09 · Đổi số điện thoại từ step OTP quay về step phone", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/905 xxx xxx/i).fill(TEST_USERS.customer.phoneRaw);
    await page.getByRole("button", { name: /gửi mã otp/i }).click();
    await expect(page.getByRole("heading", { name: /nhập mã otp/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /đổi số điện thoại/i }).click();
    await expect(page.getByRole("heading", { name: /^đăng nhập$/i })).toBeVisible();
  });
});
