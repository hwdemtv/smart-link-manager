import { test, expect } from "@playwright/test";

test.describe("User Authorization Management Debug V3", () => {
  test("debug subscription tier using direct DOM manipulation", async ({ page }) => {
    test.setTimeout(180000);

    // Capture console logs
    page.on("console", msg => {
      console.log(`[Browser ${msg.type()}] ${msg.text()}`);
    });

    // Step 1: Navigate to the admin page
    console.log("\n=== Step 1: Navigating to admin page ===");
    await page.goto("http://localhost:3002/admin");
    await page.waitForTimeout(3000);

    // Step 2: Click on Users tab
    console.log("\n=== Step 2: Clicking Users tab ===");
    const userTab = page.locator('[role="tab"]').filter({ hasText: /User|用户/ }).first();
    await userTab.click();
    await page.waitForTimeout(1000);

    // Step 3: Wait for user table and find a user
    console.log("\n=== Step 3: Finding a test user ===");
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const userRows = page.locator('table tbody tr');
    const rowCount = await userRows.count();
    console.log(`Found ${rowCount} user rows`);

    // Find a non-admin user
    let targetUserIndex = -1;
    let initialTier = "";

    for (let i = 0; i < rowCount; i++) {
      const row = userRows.nth(i);
      const cells = row.locator('td');
      const roleText = await cells.nth(3).textContent().catch(() => "");
      const tierText = await cells.nth(4).textContent().catch(() => "");

      console.log(`Row ${i}: Role="${roleText?.trim()}", Tier="${tierText?.trim()}"`);

      if (!roleText?.toLowerCase().includes('admin')) {
        targetUserIndex = i;
        initialTier = tierText?.trim() || "";
        break;
      }
    }

    if (targetUserIndex === -1) {
      targetUserIndex = 0;
      initialTier = await userRows.nth(0).locator('td').nth(4).textContent() || "Free";
    }

    console.log(`Target: Row ${targetUserIndex}, Initial tier: ${initialTier}`);

    // Step 4: Open action menu and auth dialog
    console.log("\n=== Step 4: Opening auth dialog ===");
    const targetRow = userRows.nth(targetUserIndex);
    await targetRow.locator('button').last().click();
    await page.waitForTimeout(300);
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    await page.locator('[role="menuitem"]').first().click();
    await page.waitForTimeout(500);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    // Step 5: Examine and interact with the tier select
    console.log("\n=== Step 5: Examining tier select ===");
    const dialog = page.locator('[role="dialog"]');
    const allCombos = dialog.locator('[role="combobox"], button[role="combobox"]');
    const comboCount = await allCombos.count();
    console.log(`Found ${comboCount} combobox elements`);

    // Determine target tier
    let targetTier = "pro";
    if (initialTier.toLowerCase().includes("pro")) {
      targetTier = "free";
    }
    console.log(`Target tier: ${targetTier}`);

    if (comboCount >= 2) {
      const tierSelect = allCombos.nth(1);
      console.log(`Current tier in select: ${await tierSelect.textContent()}`);

      // Method: Use JavaScript to directly set the state and trigger change
      console.log("\n=== Using JavaScript to change select value ===");

      // First, let's inspect the React component's state
      const result = await page.evaluate((target) => {
        // Find the tier select button (second combobox in dialog)
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return { success: false, error: "Dialog not found" };

        const combos = dialog.querySelectorAll('[role="combobox"], button[role="combobox"]');
        if (combos.length < 2) return { success: false, error: "Combobox not found" };

        const tierSelect = combos[1] as HTMLElement;
        console.log("Tier select found:", tierSelect.textContent);

        // Click to open the dropdown
        tierSelect.click();

        return new Promise<{ success: boolean; error?: string; options?: string[] }>((resolve) => {
          setTimeout(() => {
            // Find all options in the dropdown
            const options = document.querySelectorAll('[data-slot="select-item"], [role="option"]');
            console.log("Found options:", options.length);

            const optionTexts: string[] = [];
            options.forEach(opt => {
              optionTexts.push(opt.textContent || "");
            });

            // Find and click the target option
            for (const opt of options) {
              const text = opt.textContent?.toLowerCase() || "";
              if (text.includes(target.toLowerCase())) {
                console.log("Clicking option:", opt.textContent);
                (opt as HTMLElement).click();
                resolve({ success: true, options: optionTexts });
                return;
              }
            }

            resolve({ success: false, error: "Option not found", options: optionTexts });
          }, 500);
        });
      }, targetTier);

      console.log("JavaScript result:", JSON.stringify(result, null, 2));

      await page.waitForTimeout(500);

      // Check the new value
      const newTierValue = await tierSelect.textContent();
      console.log(`New tier select value: ${newTierValue}`);

      await page.screenshot({ path: "test-results/debug3-tier-changed.png", fullPage: true });
    }

    // Step 6: Set up network monitoring and save
    console.log("\n=== Step 6: Saving and checking network ===");

    const requestPromise = page.waitForRequest(req => req.url().includes("user.update"), { timeout: 10000 });

    const saveButton = dialog.locator('button').filter({ hasText: /确认|Confirm/ }).last();
    await saveButton.click();

    // Capture the request
    const request = await requestPromise;
    const requestBody = request.postData();
    console.log(`\nRequest URL: ${request.url()}`);
    console.log(`Request Body: ${requestBody}`);

    // Parse and check
    try {
      const parsed = JSON.parse(requestBody || "{}");
      const sentTier = parsed["0"]?.json?.subscriptionTier;
      console.log(`\nSent subscriptionTier: ${sentTier}`);
      console.log(`Target subscriptionTier: ${targetTier}`);

      if (sentTier === targetTier) {
        console.log("\n*** SUCCESS: Correct tier was sent! ***");
      } else {
        console.log("\n*** ISSUE: Wrong tier was sent! ***");
        console.log(`Expected: ${targetTier}, Got: ${sentTier}`);
      }
    } catch (e) {
      console.log("Failed to parse request body");
    }

    // Wait for response
    const response = await request.response();
    console.log(`Response status: ${response?.status()}`);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "test-results/debug3-after-save.png", fullPage: true });

    // Step 7: Re-open dialog to verify
    console.log("\n=== Step 7: Re-opening dialog to verify ===");
    const actionButton2 = userRows.nth(targetUserIndex).locator('button').last();
    await actionButton2.click();
    await page.waitForTimeout(300);
    await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    await page.locator('[role="menuitem"]').first().click();
    await page.waitForTimeout(500);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });

    const dialog2 = page.locator('[role="dialog"]');
    const allCombos2 = dialog2.locator('[role="combobox"], button[role="combobox"]');
    if (await allCombos2.count() >= 2) {
      const finalTier = await allCombos2.nth(1).textContent();
      console.log(`\nFinal tier in reopened dialog: ${finalTier}`);

      console.log("\n=== SUMMARY ===");
      console.log(`Initial tier: ${initialTier}`);
      console.log(`Target tier: ${targetTier}`);
      console.log(`Final tier in UI: ${finalTier}`);
    }
  });
});
