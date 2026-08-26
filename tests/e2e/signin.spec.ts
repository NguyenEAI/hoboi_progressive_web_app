import { test, expect } from "@playwright/test";
import { getPasswordUser, missingCredentialsReason, signInWithPassword } from "./helpers/auth";

/**
 * Sign-in flow — TEST-PLAN §4.2
 * Current production flow is phone + password. OTP is only used for password reset.
 */
test.describe("Sign-in (phone + password)", () => {
  test("SI-01 · Customer login → vào /home", async ({ page }) => {
    const customer = getPasswordUser("customer");
    test.skip(!customer, missingCredentialsReason("customer"));

    await signInWithPassword(page, customer!);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test("SI-02 · Missing password shows validation without sending OTP", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/0947010978/i).fill("0900000001");
    await page.getByRole("button", { name: /^đăng nhập$/i }).click();
    await expect(page.getByText(/vui lòng nhập mật khẩu/i)).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });

  test("SI-03 · Wrong password shows safe error", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/0947010978/i).fill("0900000001");
    await page.getByPlaceholder(/ít nhất 6 ký tự/i).fill("wrong-password-for-e2e");
    await page.getByRole("button", { name: /^đăng nhập$/i }).click();
    await expect(page.getByText(/số điện thoại hoặc mật khẩu chưa đúng|chưa thực hiện được/i)).toBeVisible({ timeout: 15_000 });
  });

  test("SI-04 · Forgot password remains OTP-gated", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("button", { name: /quên mật khẩu/i }).click();
    await expect(page.getByRole("heading", { name: /quên mật khẩu/i })).toBeVisible();
    await expect(page.getByText(/tick ô xác nhận bảo mật/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /tick xác nhận bảo mật trước|gửi mã đặt lại mật khẩu/i })).toBeVisible();
  });

  test("SI-05 · Closing and reopening the app keeps the signed-in customer", async ({ page, context }) => {
    const customer = getPasswordUser("customer");
    test.skip(!customer, missingCredentialsReason("customer"));

    await signInWithPassword(page, customer!);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
    await page.close();

    const reopened = await context.newPage();
    await reopened.goto("/home");
    await expect(reopened).toHaveURL(/\/home/, { timeout: 15_000 });
    await expect(reopened.getByText(/đăng nhập/i)).toHaveCount(0);
  });
});
