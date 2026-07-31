import { Page, expect } from "@playwright/test";

export type RoleKey = "customer" | "owner" | "receptionist" | "coach";

export type PasswordUser = {
  phoneRaw: string;
  password: string;
};

/**
 * Live E2E credentials are intentionally environment-driven.
 *
 * Required per role:
 *   E2E_CUSTOMER_PHONE + E2E_CUSTOMER_PASSWORD
 *   E2E_OWNER_PHONE + E2E_OWNER_PASSWORD
 *   E2E_RECEPTIONIST_PHONE + E2E_RECEPTIONIST_PASSWORD
 *   E2E_COACH_PHONE + E2E_COACH_PASSWORD
 *
 * Phone should be local VN form (0xxxxxxxxx) or E.164 (+84xxxxxxxxx). Tests normalize to local input.
 * Do not hard-code real account secrets in this repository.
 */
export function getPasswordUser(role: RoleKey): PasswordUser | null {
  const prefix = `E2E_${role.toUpperCase()}`;
  const phone = process.env[`${prefix}_PHONE`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!phone || !password) return null;
  return { phoneRaw: toLocalVNPhone(phone), password };
}

export function missingCredentialsReason(role: RoleKey) {
  const prefix = `E2E_${role.toUpperCase()}`;
  return `Skipped: set ${prefix}_PHONE and ${prefix}_PASSWORD to run this live ${role.toUpperCase()} phone+password test. Existing cloud accounts may not have password providers.`;
}

function toLocalVNPhone(phone: string) {
  const trimmed = phone.trim();
  if (/^0\d{9}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) return `0${digits.slice(2)}`;
  return digits.slice(-10);
}

/** Đăng nhập bằng flow hiện tại: số điện thoại + mật khẩu. */
export async function signInWithPassword(page: Page, user: PasswordUser) {
  await page.goto("/signin");
  await expect(page.getByRole("heading", { name: /^đăng nhập$/i })).toBeVisible();

  await page.getByPlaceholder(/0947010978/i).fill(user.phoneRaw);
  await page.getByPlaceholder(/ít nhất 6 ký tự/i).fill(user.password);
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();

  await page.waitForURL((url) => !url.pathname.includes("/signin"), { timeout: 20_000 });
}

/** Logout — click "Đăng xuất" trong /profile hoặc header role-specific nếu có. */
export async function signOut(page: Page) {
  await page.goto("/profile");
  await page.getByRole("button", { name: /đăng xuất/i }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
}
