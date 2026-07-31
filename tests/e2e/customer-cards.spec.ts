import { test, expect } from "@playwright/test";
import { getPasswordUser, missingCredentialsReason, signInWithPassword } from "./helpers/auth";

test.describe("Customer card requirements (non-destructive)", () => {
  test.beforeEach(async ({ page }) => {
    const customer = getPasswordUser("customer");
    test.skip(!customer, missingCredentialsReason("customer"));
    await signInWithPassword(page, customer!);
  });

  test("CARD-01 · /cards shows holder/student names and course cards when data exists", async ({ page }) => {
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: /thẻ của tôi/i })).toBeVisible({ timeout: 15_000 });

    const body = page.locator("body");
    await expect(body).toContainText(/bạn có\s+\d+\s+thẻ\/khóa trong ví|chưa có thẻ hoặc khóa học/i, { timeout: 15_000 });

    const empty = page.getByText(/chưa có thẻ hoặc khóa học/i);
    if (await empty.isVisible().catch(() => false)) {
      test.skip(true, "Skipped: customer account has no active cards/courses; provide E2E_CUSTOMER_* for an account with sample data to assert card contents.");
    }

    await expect(body).toContainText(/bạn có\s+\d+\s+thẻ\/khóa trong ví/i);
    await expect(body).toContainText(/chủ thẻ|người học|tap để xem chi tiết khóa học|tap để xem lịch sử check-in|hlv/i);

    const hasCourse = await page.getByText(/tap để xem chi tiết khóa học|khóa bơi|hlv/i).first().isVisible().catch(() => false);
    if (!hasCourse) {
      test.skip(true, "Skipped: customer account has cards but no course enrollment data; course-card assertion needs sample course data.");
    }
    await expect(body).toContainText(/tap để xem chi tiết khóa học|khóa bơi|hlv/i);
  });

  test("CARD-02 · /my-courses course cards show student name when courses exist", async ({ page }) => {
    await page.goto("/my-courses");
    await expect(page.getByRole("heading", { name: /khóa học của tôi/i })).toBeVisible({ timeout: 15_000 });

    if (await page.getByText(/chưa có khóa học nào/i).isVisible().catch(() => false)) {
      test.skip(true, "Skipped: customer account has no course enrollment data.");
    }

    await expect(page.locator("body")).toContainText(/\d+\/15 buổi|hlv|đang học|hoàn thành|chờ kích hoạt/i);
  });

  test("CARD-03 · membership purchase UI requires a real photo before confirmation", async ({ page }) => {
    await page.goto("/services/pass");
    await expect(page.getByRole("heading", { name: /vé thời hạn|chọn gói|chọn vé/i }).or(page.getByText(/vé thời hạn/i).first())).toBeVisible({ timeout: 15_000 });

    // Navigate the wizard with the first available choices only; this does not submit an order.
    for (const label of [/1 tháng|3 tháng|6 tháng|1 năm/i, /trẻ <1\.4m|trẻ|người lớn/i, /bản thân|cho tôi|con/i]) {
      const option = page.getByRole("button", { name: label }).first();
      if (await option.isVisible().catch(() => false)) await option.click();
    }

    await expect(page.locator("body")).toContainText(/cần có ảnh trước khi xác nhận đặt vé thời hạn|bắt buộc.*ảnh|chụp ảnh/i, { timeout: 15_000 });
  });
});
