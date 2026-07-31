import { test, expect, type Page } from "@playwright/test";
import { getPasswordUser, missingCredentialsReason, signInWithPassword, type RoleKey } from "./helpers/auth";

type RouteExpectation = {
  role: RoleKey;
  landing: RegExp;
  allowedPath: string;
  allowedText: RegExp;
  forbiddenPath?: string;
  redirectedTo?: RegExp;
};

const roleExpectations: RouteExpectation[] = [
  {
    role: "customer",
    landing: /\/home/,
    allowedPath: "/home",
    allowedText: /dịch vụ|thẻ của tôi|khóa học/i,
    forbiddenPath: "/admin",
    redirectedTo: /\/home/,
  },
  {
    role: "owner",
    landing: /\/admin/,
    allowedPath: "/admin/reports",
    allowedText: /báo cáo|doanh thu|chủ hồ bơi|owner/i,
    // Owner access to the coach area has no approved business rule yet.
    // Do not turn the current implementation into an accidental authorization contract.
  },
  {
    role: "receptionist",
    landing: /\/admin/,
    allowedPath: "/admin/checkin-assist",
    allowedText: /điểm danh hộ|tìm khách|số điện thoại/i,
    forbiddenPath: "/admin/reports",
    redirectedTo: /\/admin\/reports|\/admin/,
  },
  {
    role: "coach",
    landing: /\/coach/,
    allowedPath: "/coach/students",
    allowedText: /học viên|hlv|ghi chú|zalo/i,
    forbiddenPath: "/admin",
    redirectedTo: /\/coach/,
  },
];

test.describe("Role routing and authorization (phone + password)", () => {
  for (const item of roleExpectations) {
    test(`${item.role.toUpperCase()} · login lands in expected area and protected route is non-destructive`, async ({ page }) => {
      const user = getPasswordUser(item.role);
      test.skip(!user, missingCredentialsReason(item.role));

      await signInWithPassword(page, user!);
      await expect(page).toHaveURL(item.landing, { timeout: 15_000 });

      await page.goto(item.allowedPath);
      await expectVisibleText(page, item.allowedText);

      if (!item.forbiddenPath || !item.redirectedTo) return;

      await page.goto(item.forbiddenPath);
      await page.waitForLoadState("domcontentloaded");

      if (item.role === "receptionist" && item.forbiddenPath === "/admin/reports") {
        await expect(page.getByText(/chỉ chủ hồ bơi|không có quyền|không xem/i).first()).toBeVisible({ timeout: 10_000 });
      } else {
        await expect(page).toHaveURL(item.redirectedTo, { timeout: 10_000 });
      }
    });
  }
});

async function expectVisibleText(page: Page, pattern: RegExp) {
  await expect(page.locator("body")).toContainText(pattern, { timeout: 15_000 });
}
