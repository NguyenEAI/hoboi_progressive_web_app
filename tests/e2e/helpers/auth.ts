import { Page, expect } from "@playwright/test";

/**
 * Test phone numbers + OTP cố định cần được Owner thêm vào Firebase Console:
 *   Authentication → Sign-in method → Phone → "Phone numbers for testing"
 *
 * +84900000001  →  111111  (CUSTOMER mặc định)
 * +84900000002  →  222222  (CUSTOMER có con — seed 1 bé tên Linh 130cm)
 * +84900000003  →  333333  (RECEPTIONIST — Owner cần gán role qua /admin/staff)
 *
 * Owner thật (+84947010978) KHÔNG dùng trong e2e vì cần OTP SMS thật.
 */
export const TEST_USERS = {
  customer: { phoneRaw: "900000001", e164: "+84900000001", otp: "111111" },
  parent:   { phoneRaw: "900000002", e164: "+84900000002", otp: "222222" },
  staff:    { phoneRaw: "900000003", e164: "+84900000003", otp: "333333" },
} as const;

/** Đăng nhập qua OTP test number. Đợi cho tới khi điều hướng về trang sau signin. */
export async function signIn(
  page: Page,
  user: { phoneRaw: string; otp: string },
  opts: { expectName?: boolean } = {},
) {
  await page.goto("/signin");

  // Step phone
  await page.getByPlaceholder(/905 xxx xxx/i).fill(user.phoneRaw);
  await page.getByRole("button", { name: /gửi mã otp/i }).click();

  // Step OTP (đợi step chuyển)
  await expect(page.getByRole("heading", { name: /nhập mã otp/i })).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder("• • • • • •").fill(user.otp);
  await page.getByRole("button", { name: /xác nhận$/i }).click();

  if (opts.expectName) {
    await expect(page.getByRole("heading", { name: /hoàn tất hồ sơ/i })).toBeVisible({ timeout: 10_000 });
  } else {
    // Đợi điều hướng khỏi /signin
    await page.waitForURL((url) => !url.pathname.includes("/signin"), { timeout: 15_000 });
  }
}

/** Logout — click "Đăng xuất" trong /profile */
export async function signOut(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: /đăng xuất/i }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
}
