import { test, expect } from "@playwright/test";

/**
 * Smoke Test — TEST-PLAN §3
 * Phải pass trước mỗi deploy. Không cần đăng nhập.
 */
test.describe("Smoke (TEST-PLAN §3)", () => {
  test("SM-01 · Landing hiển thị đầy đủ", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Prosper Plaza/i).first()).toBeVisible();
    await expect(page.getByText(/Phan Văn Hớn/i)).toBeVisible();
    await expect(page.getByText(/Vé tháng/i)).toBeVisible();
    await expect(page.getByText(/Khóa học bơi/i).first()).toBeVisible();
    await expect(page.getByText(/Bảng giá vé lẻ/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /đăng nhập/i })).toBeVisible();
  });

  test("SM-01b · không có lỗi JS console khi load Landing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // bỏ qua các warning từ extension (Trancy, Grammarly)
    const realErrors = errors.filter(
      (e) => !/trancy|grammarly|extension/i.test(e),
    );
    expect(realErrors, `JS errors:\n${realErrors.join("\n")}`).toHaveLength(0);
  });

  test("SM-03 · Click Đăng nhập → vào /signin step phone", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /đăng nhập/i }).first().click();
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole("heading", { name: /^đăng nhập$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/905 xxx xxx/i)).toBeVisible();
  });

  test("PUB-04 · Mobile responsive (360px)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    // header không tràn ngang
    const headerOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(headerOverflow).toBeLessThanOrEqual(2);
  });

  test("PUB-05 · PDPL badge hiển thị", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/PDPL/i)).toBeVisible();
  });
});
