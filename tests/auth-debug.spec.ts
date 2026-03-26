import { test, expect } from "@playwright/test";

test.describe("User Authorization Management Debug", () => {
  test("debug subscription tier update with network logging", async ({ page, context }) => {
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

    // Step 1: Navigate to the correct port
    console.log("\n=== Step 1: Navigating to admin page (port 3002) ===");
    await page.goto("http://localhost:3002/admin");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/debug-01-admin.png", fullPage: true });

    // Check if we're logged in
    const adminUrl = page.url();
    console.log(`Current URL: ${adminUrl}`);

    // Step 2: Click on Users tab
    console.log("\n=== Step 2: Clicking Users tab ===");
    const userTab = page.locator('[role="tab"]').filter({ hasText: /User|用户/ }).first();
    await userTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/debug-02-users.png", fullPage: true });

    // Step 3: Wait for user table
    console.log("\n=== Step 3: Waiting for user table ===");
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const userRows = page.locator('table tbody tr');
    const rowCount = await userRows.count();
    console.log(`Found ${rowCount} user rows`);

    // Find a test user - look for one that's not admin
    let targetUserIndex = -1;
    let initialTier = "";

    for (let i = 0; i < rowCount; i++) {
      const row = userRows.nth(i);
      const rowText = await row.textContent().catch(() => "");
      console.log(`Row ${i}: ${rowText?.substring(0, 100)}`);

      // Get tier from row (column 4, 0-indexed)
      const cells = row.locator('td');
      const cellCount = await cells.count();

      if (cellCount > 4) {
        const roleText = await cells.nth(3).textContent().catch(() => "");
        const tierText = await cells.nth(4).textContent().catch(() => "");

        console.log(`  Role: ${roleText?.trim()}, Tier: ${tierText?.trim()}`);

        if (!roleText?.toLowerCase().includes('admin')) {
          targetUserIndex = i;
          initialTier = tierText?.trim() || "";
          console.log(`Selected row ${i} as target user`);
          break;
        }
      }
    }

    // If no non-admin user, use the last user
    if (targetUserIndex === -1) {
      targetUserIndex = rowCount - 1;
      const lastRow = userRows.nth(targetUserIndex);
      const cells = lastRow.locator('td');
      initialTier = await cells.nth(4).textContent().catch(() => "") || "Free";
      console.log(`No non-admin found, using last row with tier: ${initialTier}`);
    }

    console.log(`\nTarget user index: ${targetUserIndex}`);
    console.log(`Initial tier: ${initialTier}`);

    // Step 4: Open action menu
    console.log("\n=== Step 4: Opening action menu ===");
    const targetRow = userRows.nth(targetUserIndex);
    const actionButton = targetRow.locator('button').last();
    await actionButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/debug-03-action-menu.png", fullPage: true });

    // Step 5: Click auth management
    console.log("\n=== Step 5: Clicking auth management ===");
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    const authMenuItem = page.locator('[role="menuitem"]').first();
    await authMenuItem.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.screenshot({ path: "test-results/debug-04-auth-dialog.png", fullPage: true });

    // Step 6: Examine the dialog
    console.log("\n=== Step 6: Examining dialog ===");
    const dialog = page.locator('[role="dialog"]');
    const selects = dialog.locator('[role="combobox"], button[role="combobox"]');
    const selectCount = await selects.count();
    console.log(`Found ${selectCount} select elements`);

    for (let i = 0; i < selectCount; i++) {
      const selectText = await selects.nth(i).textContent().catch(() => "");
      console.log(`Select ${i}: ${selectText}`);
    }

    // Step 7: Change tier
    console.log("\n=== Step 7: Changing subscription tier ===");

    // Determine target tier
    let targetTier = "Pro";
    if (initialTier.toLowerCase().includes("pro")) {
      targetTier = "Free";
    } else if (initialTier.toLowerCase().includes("free")) {
      targetTier = "Pro";
    } else if (initialTier.toLowerCase().includes("business")) {
      targetTier = "Pro";
    }

    console.log(`Target tier: ${targetTier}`);

    if (selectCount >= 2) {
      const tierSelect = selects.nth(1);
      console.log(`Current tier in dialog: ${await tierSelect.textContent()}`);

      // Click to open dropdown
      await tierSelect.click();
      await page.waitForTimeout(500);

      // Wait for dropdown to appear
      await page.waitForSelector('[role="option"], [data-slot="select-item"]', { timeout: 3000 });
      await page.screenshot({ path: "test-results/debug-05-dropdown.png", fullPage: true });

      // Find and click the target option
      const options = page.locator('[role="option"], [data-slot="select-item"]');
      const optionCount = await options.count();
      console.log(`Found ${optionCount} options`);

      for (let i = 0; i < optionCount; i++) {
        const optionText = await options.nth(i).textContent().catch(() => "");
        console.log(`Option ${i}: ${optionText}`);

        if (optionText?.toLowerCase().includes(targetTier.toLowerCase())) {
          await options.nth(i).click();
          console.log(`Clicked option: ${optionText}`);
          break;
        }
      }

      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/debug-06-tier-selected.png", fullPage: true });

      // Verify the select shows new value
      const newSelectValue = await tierSelect.textContent();
      console.log(`New select value: ${newSelectValue}`);
    }

    // Step 8: Click save
    console.log("\n=== Step 8: Clicking save ===");
    const saveButton = dialog.locator('button').filter({ hasText: /确认|Confirm/ }).last();
    console.log(`Save button text: ${await saveButton.textContent()}`);

    // Clear previous network logs
    networkLogs.length = 0;

    await saveButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/debug-07-after-save.png", fullPage: true });

    // Step 9: Check result
    console.log("\n=== Step 9: Checking results ===");
    const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    console.log(`Dialog visible after save: ${dialogVisible}`);

    // Print network logs
    console.log("\n=== Network Logs ===");
    for (const log of networkLogs) {
      console.log(`\nURL: ${log.url}`);
      console.log(`Method: ${log.method}`);
      console.log(`Status: ${log.status}`);
      if (log.body) {
        console.log(`Request Body: ${log.body}`);
      }
      if (log.response) {
        console.log(`Response Body: ${log.response}`);
      }
    }

    // Step 10: Check user list
    console.log("\n=== Step 10: Checking user list ===");
    await page.waitForTimeout(1000);
    const updatedRow = userRows.nth(targetUserIndex);
    const updatedCells = updatedRow.locator('td');
    const updatedTier = await updatedCells.nth(4).textContent().catch(() => "");
    console.log(`Tier in list after save: ${updatedTier}`);

    // Step 11: Re-open dialog to verify
    console.log("\n=== Step 11: Re-opening dialog to verify ===");
    const actionButton2 = userRows.nth(targetUserIndex).locator('button').last();
    await actionButton2.click();
    await page.waitForTimeout(500);
    await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    await page.locator('[role="menuitem"]').first().click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.screenshot({ path: "test-results/debug-08-verify.png", fullPage: true });

    const dialog2 = page.locator('[role="dialog"]');
    const selects2 = dialog2.locator('[role="combobox"], button[role="combobox"]');
    if (await selects2.count() >= 2) {
      const tierValue = await selects2.nth(1).textContent();
      console.log(`Tier in reopened dialog: ${tierValue}`);

      // Final verification
      console.log("\n=== FINAL VERIFICATION ===");
      console.log(`Initial tier: ${initialTier}`);
      console.log(`Target tier: ${targetTier}`);
      console.log(`Tier after save: ${tierValue}`);

      if (tierValue?.toLowerCase().includes(targetTier.toLowerCase())) {
        console.log("SUCCESS: Tier was updated correctly!");
      } else {
        console.log("ISSUE: Tier was NOT updated!");
      }
    }

    // Print all console logs
    console.log("\n=== All Browser Console Logs ===");
    for (const log of consoleLogs) {
      console.log(log);
    }
  });
});
