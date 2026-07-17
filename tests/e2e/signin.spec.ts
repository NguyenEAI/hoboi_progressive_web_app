import { test, expect } from "@playwright/test";
import { TEST_USERS, signIn } from "./helpers/auth";

/**
 * Sign-in flow â€” TEST-PLAN Â§4.2
 * Cáº§n test numbers Ä‘Ã£ setup trong Firebase Console.
 */
test.describe("Sign-in (TEST-PLAN Â§4.2)", () => {
  test("SI-01 Â· Customer login â†’ vÃ o /home", async ({ page }) => {
    await signIn(page, TEST_USERS.customer);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test("SI-02 Â· Login láº¡i (Ä‘Ã£ cÃ³ doc) â†’ bá» qua bÆ°á»›c nháº­p tÃªn", async ({ page }) => {
    // Láº§n Ä‘áº§u â€” náº¿u user chÆ°a cÃ³ fullName, sáº½ hiá»‡n bÆ°á»›c name. Skip á»Ÿ Ä‘Ã¢y vÃ¬
    // giáº£ Ä‘á»‹nh Owner Ä‘Ã£ pre-seed fullName cho test numbers.
    await signIn(page, TEST_USERS.customer);
    await expect(page).toHaveURL(/\/home/, { timeout: 15_000 });
  });

  test("SI-05 Â· Resend OTP cÃ³ countdown 60s", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/0947010978/i).fill(TEST_USERS.customer.phoneRaw);
    await page.getByRole("button", { name: /OTP/i }).click();
    await expect(page.getByText(/gá»­i láº¡i sau \d+s/i)).toBeVisible({ timeout: 10_000 });
  });

  test("SI-06 Â· OTP sai â†’ toast lá»—i", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/0947010978/i).fill(TEST_USERS.customer.phoneRaw);
    await page.getByRole("button", { name: /OTP/i }).click();

    await expect(page.getByRole("heading", { name: /nháº­p mÃ£ otp/i })).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("â€¢ â€¢ â€¢ â€¢ â€¢ â€¢").fill("000000");
    await page.getByRole("button", { name: /xÃ¡c nháº­n$/i }).click();

    // toast hoáº·c message lá»—i xuáº¥t hiá»‡n
    await expect(page.locator("text=/invalid|sai|verification|fail/i").first())
      .toBeVisible({ timeout: 10_000 });
  });

  test("SI-09 Â· Äá»•i sá»‘ Ä‘iá»‡n thoáº¡i tá»« step OTP quay vá» step phone", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder(/0947010978/i).fill(TEST_USERS.customer.phoneRaw);
    await page.getByRole("button", { name: /OTP/i }).click();
    await expect(page.getByRole("heading", { name: /nháº­p mÃ£ otp/i })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /Ä‘á»•i sá»‘ Ä‘iá»‡n thoáº¡i/i }).click();
    await expect(page.getByRole("heading", { name: /^Ä‘Äƒng nháº­p$/i })).toBeVisible();
  });
});



