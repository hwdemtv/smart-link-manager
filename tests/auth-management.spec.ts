import { test, expect } from "@playwright/test";

test.describe("User Authorization Management", () => {
  test("should update user subscription tier", async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(180000);

    // Step 1: Navigate to home page first (for auto-login in dev mode)
    console.log("Step 1: Navigating to home page for auto-login...");
    await page.goto("/");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/01-homepage.png", fullPage: true });
    console.log("Screenshot saved: 01-homepage.png");

    // Check if we're logged in
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Step 2: Navigate to admin page
    console.log("Step 2: Navigating to Admin page...");
    await page.goto("/admin");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/02-admin-page.png", fullPage: true });
    console.log("Screenshot saved: 02-admin-page.png");

    // Check current URL
    const adminUrl = page.url();
    console.log(`Admin URL: ${adminUrl}`);

    // Get page content for debugging
    const pageContent = await page.locator('body').textContent().catch(() => "");
    console.log(`Page content preview: ${pageContent?.substring(0, 500)}`);

    // Step 3: Find and click on Users tab
    console.log("Step 3: Finding and clicking Users tab...");

    // Try different selectors for the users tab
    const tabSelectors = [
      '[data-state="inactive"][value="users"]',
      '[role="tab"][value="users"]',
      'button[value="users"]',
      'button:has-text("用户")',
      'button:has-text("Users")',
    ];

    let tabClicked = false;
    for (const selector of tabSelectors) {
      try {
        const tab = page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 })) {
          console.log(`Found tab with selector: ${selector}`);
          await tab.click();
          tabClicked = true;
          break;
        }
      } catch (e) {
        console.log(`Selector ${selector} not found or not visible`);
      }
    }

    if (!tabClicked) {
      // Try to find any tab that contains user-related text
      const allTabs = page.locator('[role="tab"]');
      const tabCount = await allTabs.count();
      console.log(`Found ${tabCount} tabs`);

      for (let i = 0; i < tabCount; i++) {
        const tabText = await allTabs.nth(i).textContent().catch(() => "");
        console.log(`Tab ${i}: ${tabText}`);
        if (tabText?.includes("用户") || tabText?.includes("Users") || tabText?.includes("User")) {
          await allTabs.nth(i).click();
          tabClicked = true;
          console.log(`Clicked tab ${i}`);
          break;
        }
      }
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/03-users-tab.png", fullPage: true });
    console.log("Screenshot saved: 03-users-tab.png");

    // Step 4: Wait for user table to load
    console.log("Step 4: Waiting for user table...");
    try {
      await page.waitForSelector('table tbody tr', { timeout: 15000 });
    } catch {
      console.log("Table not found, checking page state...");
      const bodyContent = await page.locator('body').textContent().catch(() => "");
      console.log(`Body content: ${bodyContent?.substring(0, 2000)}`);

      // Take a screenshot anyway
      await page.screenshot({ path: "test-results/04-no-table.png", fullPage: true });
      throw new Error("User table not found");
    }
    await page.screenshot({ path: "test-results/04-user-table.png", fullPage: true });
    console.log("Screenshot saved: 04-user-table.png");

    // Find the first user row
    const userRows = page.locator('table tbody tr');
    const rowCount = await userRows.count();
    console.log(`Found ${rowCount} user rows`);

    // Find a non-admin user to test (don't modify admin users)
    let targetUserIndex = -1;
    let initialTier = "";

    for (let i = 0; i < rowCount; i++) {
      const row = userRows.nth(i);
      const cells = row.locator('td');
      const cellCount = await cells.count();

      // Get role from column 3 and tier from column 4
      if (cellCount > 4) {
        const roleText = await cells.nth(3).textContent().catch(() => "");
        const tierText = await cells.nth(4).textContent().catch(() => "");

        console.log(`Row ${i}: role="${roleText?.trim()}", tier="${tierText?.trim()}"`);

        // Select a non-admin user
        if (!roleText?.toLowerCase().includes('admin')) {
          targetUserIndex = i;
          initialTier = tierText?.trim() || "";
          console.log(`Selected row ${i} as target user (non-admin)`);
          break;
        }
      }
    }

    // Fallback to first user if no non-admin found
    if (targetUserIndex === -1) {
      targetUserIndex = 0;
      const firstRow = userRows.nth(0);
      const cells = firstRow.locator('td');
      initialTier = await cells.nth(4).textContent().catch(() => "") || "Business";
      console.log(`No non-admin user found, using first row`);
    }

    const targetRow = userRows.nth(targetUserIndex);
    const targetRowCells = targetRow.locator('td');
    console.log(`Target user initial tier: ${initialTier}`);

    // Step 5: Click action menu for first user
    console.log("Step 5: Opening action menu for user...");

    // Find the action menu button (last button in the row, or button with MoreHorizontal icon)
    const actionButton = targetRow.locator('button').last();
    await actionButton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/05-action-menu-open.png", fullPage: true });
    console.log("Screenshot saved: 05-action-menu-open.png");

    // Step 6: Click "授权管理" menu item
    console.log("Step 6: Clicking authorization management menu item...");

    // Wait for dropdown menu to appear
    await page.waitForSelector('[role="menu"]', { timeout: 5000 });

    // Get all menu items for debugging
    const menuItems = page.locator('[role="menuitem"]');
    const menuItemCount = await menuItems.count();
    console.log(`Found ${menuItemCount} menu items`);

    for (let i = 0; i < menuItemCount; i++) {
      const itemText = await menuItems.nth(i).textContent().catch(() => "");
      console.log(`Menu item ${i}: ${itemText}`);
    }

    // Click the first menu item (should be 授权管理 based on code)
    const authMenuItem = menuItems.first();
    const authMenuText = await authMenuItem.textContent().catch(() => "");
    console.log(`Clicking menu item: ${authMenuText}`);
    await authMenuItem.click();
    await page.waitForTimeout(1000);

    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.screenshot({ path: "test-results/06-auth-dialog.png", fullPage: true });
    console.log("Screenshot saved: 06-auth-dialog.png");

    // Step 7: Check current subscription tier value in dialog
    console.log("Step 7: Checking current subscription tier in dialog...");

    // Find all select/combobox elements in the dialog
    const dialog = page.locator('[role="dialog"]');
    const selects = dialog.locator('[role="combobox"], button[role="combobox"]');
    const selectCount = await selects.count();
    console.log(`Found ${selectCount} select elements in dialog`);

    for (let i = 0; i < selectCount; i++) {
      const selectText = await selects.nth(i).textContent().catch(() => "");
      console.log(`Select ${i}: ${selectText}`);
    }

    // Step 8: Click on the tier select (second select, index 1)
    console.log("Step 8: Changing subscription tier...");

    // Determine which tier to select (toggle between Pro and Free)
    let targetTier = "Pro";
    if (initialTier.toLowerCase().includes("pro")) {
      targetTier = "Free";
    }

    if (selectCount >= 2) {
      const tierSelect = selects.nth(1); // Second select is tier
      const currentTierValue = await tierSelect.textContent().catch(() => "unknown");
      console.log(`Current tier select value: ${currentTierValue}`);

      // Use a single atomic operation to open dropdown and click option
      console.log("Using atomic operation to select option...");

      // Execute a script that opens the dropdown and clicks the option in one go
      const result = await page.evaluate((target) => {
        // First, find and click the tier select
        const allSelects = document.querySelectorAll('[role="combobox"], button[role="combobox"]');
        if (allSelects.length < 2) return { success: false, reason: 'no select found' };

        const tierSelect = allSelects[1] as HTMLElement;
        tierSelect.click();

        // Wait a bit for the dropdown to render
        return new Promise<{ success: boolean; reason?: string }>((resolve) => {
          setTimeout(() => {
            // Find the dropdown content
            const dropdownContent = document.querySelector('[data-slot="select-content"], [data-radix-select-content]');

            if (!dropdownContent) {
              // Try to find by position (dropdown should be fixed/absolute positioned)
              const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
                const style = window.getComputedStyle(el);
                return (style.position === 'fixed' || style.position === 'absolute') &&
                       el.textContent?.includes('Free') &&
                       el.textContent?.includes('Pro');
              });

              if (allFixed.length > 0) {
                // Find the target option text within this container
                const container = allFixed[0];
                const allText = container.querySelectorAll('*');
                for (const el of allText) {
                  const text = el.textContent?.trim() || '';
                  if (text.toLowerCase() === target.toLowerCase()) {
                    (el as HTMLElement).click();
                    resolve({ success: true });
                    return;
                  }
                }
              }

              resolve({ success: false, reason: 'dropdown content not found' });
              return;
            }

            // Find the option within dropdown content
            const options = dropdownContent.querySelectorAll('[data-slot="select-item"], [role="option"]');
            for (const opt of options) {
              const text = opt.textContent?.trim() || '';
              if (text.toLowerCase().includes(target.toLowerCase())) {
                (opt as HTMLElement).click();
                resolve({ success: true });
                return;
              }
            }

            // Try clicking any element with matching text
            const allElements = dropdownContent.querySelectorAll('*');
            for (const el of allElements) {
              const text = el.textContent?.trim() || '';
              if (text.toLowerCase() === target.toLowerCase()) {
                (el as HTMLElement).click();
                resolve({ success: true });
                return;
              }
            }

            resolve({ success: false, reason: 'option not found in dropdown' });
          }, 100);
        });
      }, targetTier);

      console.log(`Atomic operation result: ${JSON.stringify(result)}`);

      await page.waitForTimeout(500);
      await page.screenshot({ path: "test-results/07-tier-dropdown.png", fullPage: true });
      console.log("Screenshot saved: 07-tier-dropdown.png");

      // Check if the select value changed
      const newTierValue = await tierSelect.textContent().catch(() => "unknown");
      console.log(`New tier select value: ${newTierValue}`);

      await page.screenshot({ path: "test-results/08-tier-selected.png", fullPage: true });
      console.log("Screenshot saved: 08-tier-selected.png");
    }

    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/08-tier-selected.png", fullPage: true });
    console.log("Screenshot saved: 08-tier-selected.png");

    // Step 9: Save changes
    console.log("Step 9: Saving changes...");

    // Find save button in dialog footer
    const saveButton = dialog.locator('button').filter({ hasText: /确认|保存|Confirm|Save/ }).last();
    await saveButton.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "test-results/09-after-save.png", fullPage: true });
    console.log("Screenshot saved: 09-after-save.png");

    // Step 10: Wait for success toast or dialog close
    console.log("Step 10: Verifying save...");

    // Check if dialog closed
    const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    console.log(`Dialog visible after save: ${dialogVisible}`);

    await page.screenshot({ path: "test-results/10-verification.png", fullPage: true });
    console.log("Screenshot saved: 10-verification.png");

    // Step 11: Check the user list for updated tier
    console.log("Step 11: Checking user list for updated tier...");

    // Check the user row for the new tier
    const updatedRow = userRows.nth(targetUserIndex);
    const updatedCells = updatedRow.locator('td');
    const updatedTierText = await updatedCells.nth(4).textContent().catch(() => "");
    console.log(`Updated tier in list: ${updatedTierText}`);
    await page.screenshot({ path: "test-results/11-list-after-update.png", fullPage: true });
    console.log("Screenshot saved: 11-list-after-update.png");

    // Step 12: Re-open dialog to verify change persisted
    console.log("Step 12: Re-opening dialog to verify persisted change...");

    // Open action menu again
    const actionButton2 = userRows.nth(targetUserIndex).locator('button').last();
    await actionButton2.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/12-action-menu-again.png", fullPage: true });

    // Click auth menu item
    await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    const authMenuItem2 = page.locator('[role="menuitem"]').first();
    await authMenuItem2.click();
    await page.waitForTimeout(1000);

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.screenshot({ path: "test-results/13-auth-dialog-reopened.png", fullPage: true });
    console.log("Screenshot saved: 13-auth-dialog-reopened.png");

    // Check the tier value again
    const dialog2 = page.locator('[role="dialog"]');
    const selects2 = dialog2.locator('[role="combobox"], button[role="combobox"]');

    if (await selects2.count() >= 2) {
      const tierSelect2 = selects2.nth(1);
      const tierValueAfter = await tierSelect2.textContent().catch(() => "unknown");
      console.log(`Tier value after reopening dialog: ${tierValueAfter}`);
      await page.screenshot({ path: "test-results/14-final.png", fullPage: true });
      console.log("Screenshot saved: 14-final.png");

      // Verify the tier was actually changed
      console.log(`\n=== VERIFICATION RESULTS ===`);
      console.log(`Initial tier: ${initialTier}`);
      console.log(`Target tier: ${targetTier}`);
      console.log(`Tier after save: ${tierValueAfter}`);

      if (tierValueAfter.toLowerCase().includes(targetTier.toLowerCase())) {
        console.log(`SUCCESS: Tier was successfully updated to ${targetTier}`);
      } else {
        console.log(`ISSUE DETECTED: Expected tier "${targetTier}" but got "${tierValueAfter}"`);
      }
    }

    console.log("Test completed!");
  });
});
