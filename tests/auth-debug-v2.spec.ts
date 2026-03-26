import { test, expect } from "@playwright/test";

test.describe("User Authorization Management Debug V2", () => {
  test("debug subscription tier update with detailed select interaction", async ({ page, context }) => {
    test.setTimeout(180000);

    // Capture console logs
    const consoleLogs: string[] = [];
    page.on("console", msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(text);
      console.log(`Browser Console: ${text}`);
    });

    // Capture network requests
    const networkLogs: { url: string; method: string; status: number; body?: string; response?: string }[] = [];
    page.on("request", request => {
      if (request.url().includes("/api/trpc/")) {
        const entry: typeof networkLogs[0] = {
          url: request.url(),
          method: request.method(),
          status: 0,
          body: request.postData() || undefined,
        };
        networkLogs.push(entry);
        console.log(`Request: ${request.method()} ${request.url()}`);
        if (entry.body) {
          console.log(`  Request Body: ${entry.body.substring(0, 500)}`);
        }
      }
    });

    page.on("response", async response => {
      if (response.url().includes("/api/trpc/user.update")) {
        const entry = networkLogs.find(e => e.url === response.url() && e.status === 0);
        if (entry) {
          entry.status = response.status();
          try {
            entry.response = await response.text();
          } catch {}
        }
        console.log(`Response: ${response.status()} ${response.url()}`);
        const responseBody = await response.text().catch(() => "N/A");
        console.log(`  Response Body: ${responseBody.substring(0, 500)}`);
      }
    });

    // Step 1: Navigate to the admin page
    console.log("\n=== Step 1: Navigating to admin page (port 3002) ===");
    await page.goto("http://localhost:3002/admin");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/debug2-01-admin.png", fullPage: true });

    // Step 2: Click on Users tab
    console.log("\n=== Step 2: Clicking Users tab ===");
    const userTab = page.locator('[role="tab"]').filter({ hasText: /User|用户/ }).first();
    await userTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/debug2-02-users.png", fullPage: true });

    // Step 3: Wait for user table
    console.log("\n=== Step 3: Waiting for user table ===");
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const userRows = page.locator('table tbody tr');
    const rowCount = await userRows.count();
    console.log(`Found ${rowCount} user rows`);

    // Find a test user
    let targetUserIndex = -1;
    let initialTier = "";

    for (let i = 0; i < rowCount; i++) {
      const row = userRows.nth(i);
      const cells = row.locator('td');
      const cellCount = await cells.count();

      if (cellCount > 4) {
        const roleText = await cells.nth(3).textContent().catch(() => "");
        const tierText = await cells.nth(4).textContent().catch(() => "");

        console.log(`Row ${i}: Role="${roleText?.trim()}", Tier="${tierText?.trim()}"`);

        if (!roleText?.toLowerCase().includes('admin')) {
          targetUserIndex = i;
          initialTier = tierText?.trim() || "";
          console.log(`Selected row ${i} as target user`);
          break;
        }
      }
    }

    if (targetUserIndex === -1) {
      targetUserIndex = rowCount - 1;
      const lastRow = userRows.nth(targetUserIndex);
      const cells = lastRow.locator('td');
      initialTier = await cells.nth(4).textContent().catch(() => "") || "Free";
    }

    console.log(`Target user index: ${targetUserIndex}, Initial tier: ${initialTier}`);

    // Step 4: Open action menu
    console.log("\n=== Step 4: Opening action menu ===");
    const targetRow = userRows.nth(targetUserIndex);
    const actionButton = targetRow.locator('button').last();
    await actionButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/debug2-03-action-menu.png", fullPage: true });

    // Step 5: Click auth management
    console.log("\n=== Step 5: Clicking auth management ===");
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    const authMenuItem = page.locator('[role="menuitem"]').first();
    await authMenuItem.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.screenshot({ path: "test-results/debug2-04-auth-dialog.png", fullPage: true });

    // Step 6: Examine the dialog
    console.log("\n=== Step 6: Examining dialog ===");
    const dialog = page.locator('[role="dialog"]');

    // Find the tier select button using more specific selectors
    console.log("Looking for tier select button...");

    // The tier select should be the second combobox in the "角色与套餐" section
    const allCombos = dialog.locator('[role="combobox"], button[role="combobox"]');
    const comboCount = await allCombos.count();
    console.log(`Found ${comboCount} combobox elements`);

    for (let i = 0; i < comboCount; i++) {
      const comboText = await allCombos.nth(i).textContent().catch(() => "");
      console.log(`Combobox ${i}: "${comboText}"`);
    }

    // Determine target tier
    let targetTier = "pro";
    if (initialTier.toLowerCase().includes("pro")) {
      targetTier = "free";
    }
    console.log(`Target tier: ${targetTier}`);

    // Step 7: Change tier using keyboard navigation (more reliable)
    console.log("\n=== Step 7: Changing subscription tier ===");

    if (comboCount >= 2) {
      const tierSelect = allCombos.nth(1); // Second combobox is tier
      const currentTier = await tierSelect.textContent();
      console.log(`Current tier in select: ${currentTier}`);

      // Method 1: Use keyboard to navigate
      console.log("Clicking tier select...");
      await tierSelect.click();
      await page.waitForTimeout(500);

      // Check if dropdown opened
      const selectContent = page.locator('[data-slot="select-content"], [data-radix-select-content-area]');
      const contentVisible = await selectContent.isVisible().catch(() => false);
      console.log(`Select content visible: ${contentVisible}`);

      await page.screenshot({ path: "test-results/debug2-05-dropdown-open.png", fullPage: true });

      // Try to find options using various selectors
      const optionSelectors = [
        '[role="option"]',
        '[data-slot="select-item"]',
        '[data-radix-select-item]',
        '[role="option"] [data-slot="select-item"]',
        '.radix-select-item',
      ];

      let foundOptions = false;
      for (const selector of optionSelectors) {
        const options = page.locator(selector);
        const optCount = await options.count().catch(() => 0);
        if (optCount > 0) {
          console.log(`Found ${optCount} options with selector: ${selector}`);
          foundOptions = true;

          for (let i = 0; i < optCount; i++) {
            const optText = await options.nth(i).textContent().catch(() => "");
            console.log(`  Option ${i}: "${optText}"`);
          }

          // Click the target option
          for (let i = 0; i < optCount; i++) {
            const optText = await options.nth(i).textContent().catch(() => "");
            if (optText?.toLowerCase().includes(targetTier.toLowerCase())) {
              console.log(`Clicking option: "${optText}"`);
              await options.nth(i).click();
              break;
            }
          }
          break;
        }
      }

      if (!foundOptions) {
        console.log("No options found with standard selectors, trying keyboard navigation...");

        // Press ArrowDown to open dropdown if not already open
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(300);

        // Press ArrowDown until we reach the target tier
        const targetText = targetTier.charAt(0).toUpperCase() + targetTier.slice(1);
        console.log(`Looking for tier "${targetText}"...`);

        // Press ArrowDown and check value
        for (let i = 0; i < 5; i++) {
          const tierValue = await tierSelect.textContent();
          console.log(`After ArrowDown ${i} times, select shows: ${tierValue}`);

          if (tierValue?.toLowerCase().includes(targetTier.toLowerCase())) {
            console.log("Found target tier!");
            break;
          }

          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
        }

        // Press Enter to select
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }

      // Verify new value
      const newTierValue = await tierSelect.textContent();
      console.log(`New tier select value: ${newTierValue}`);
      await page.screenshot({ path: "test-results/debug2-06-tier-changed.png", fullPage: true });
    }

    // Step 8: Click save
    console.log("\n=== Step 8: Clicking save ===");
    networkLogs.length = 0;

    const saveButton = dialog.locator('button').filter({ hasText: /确认|Confirm/ }).last();
    console.log(`Save button text: ${await saveButton.textContent()}`);
    await saveButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/debug2-07-after-save.png", fullPage: true });

    // Step 9: Check network request
    console.log("\n=== Step 9: Checking network request ===");
    const updateRequest = networkLogs.find(log => log.url.includes("user.update"));
    if (updateRequest) {
      console.log(`\nUpdate request found!`);
      console.log(`Request Body: ${updateRequest.body}`);

      // Parse the request body
      try {
        const parsed = JSON.parse(updateRequest.body || "{}");
        const subscriptionTier = parsed["0"]?.json?.subscriptionTier;
        console.log(`subscriptionTier in request: ${subscriptionTier}`);

        if (subscriptionTier === targetTier) {
          console.log("SUCCESS: Request contains correct subscriptionTier!");
        } else {
          console.log(`ISSUE: Request contains wrong subscriptionTier. Expected: ${targetTier}, Got: ${subscriptionTier}`);
        }
      } catch (e) {
        console.log("Failed to parse request body");
      }
    } else {
      console.log("No user.update request found in network logs!");
    }

    // Step 10: Verify in UI
    console.log("\n=== Step 10: Verifying in UI ===");
    const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    console.log(`Dialog visible after save: ${dialogVisible}`);

    // Check user list
    const updatedRow = userRows.nth(targetUserIndex);
    const updatedCells = updatedRow.locator('td');
    const updatedTier = await updatedCells.nth(4).textContent().catch(() => "");
    console.log(`Tier in list after save: ${updatedTier}`);

    // Re-open dialog to verify
    console.log("\n=== Step 11: Re-opening dialog to verify ===");
    const actionButton2 = userRows.nth(targetUserIndex).locator('button').last();
    await actionButton2.click();
    await page.waitForTimeout(500);
    await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    await page.locator('[role="menuitem"]').first().click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.screenshot({ path: "test-results/debug2-08-final-verify.png", fullPage: true });

    const dialog2 = page.locator('[role="dialog"]');
    const allCombos2 = dialog2.locator('[role="combobox"], button[role="combobox"]');
    if (await allCombos2.count() >= 2) {
      const finalTier = await allCombos2.nth(1).textContent();
      console.log(`Tier in reopened dialog: ${finalTier}`);

      console.log("\n=== FINAL RESULTS ===");
      console.log(`Initial tier: ${initialTier}`);
      console.log(`Target tier: ${targetTier}`);
      console.log(`Final tier in UI: ${finalTier}`);

      if (finalTier?.toLowerCase().includes(targetTier.toLowerCase())) {
        console.log("SUCCESS: Tier was updated correctly!");
      } else {
        console.log("ISSUE: Tier was NOT updated correctly!");
      }
    }

    // Print all console logs
    console.log("\n=== All Browser Console Logs ===");
    for (const log of consoleLogs) {
      console.log(log);
    }
  });
});
