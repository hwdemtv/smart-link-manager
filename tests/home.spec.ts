import { test, expect } from "@playwright/test";

test.describe("Smart Link Manager - Homepage", () => {
  test("should load the homepage and display basic branding", async ({
    page,
  }) => {
    // Navigate to the root URL
    await page.goto("/");

    // Expect the title to contain branding
    await expect(page).toHaveTitle(/.*Smart Link.*/i);

    // Look for the main hero heading or branding element
    // Depending on the exact locale, it might be in English or Chinese.
    // We check for a common structural element like a primary header.
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible();

    // Check if there are login/dashboard action buttons
    // Typically an auth gateway presents a login or get-started call-to-action
    const actionLinks = page
      .locator("a, button")
      .filter({ hasText: /(Login|登录|Sign In|Start|Dashboard)/i })
      .first();
    await expect(actionLinks).toBeVisible();
  });
});
