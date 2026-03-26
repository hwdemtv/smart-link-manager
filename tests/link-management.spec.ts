import { test, expect } from "@playwright/test";

/**
 * 链接管理核心业务流程测试
 * 覆盖：创建链接 (含 AI 生成)、查找、编辑、分页导出
 */
test.describe("Link Management Core Flow", () => {
  test("should complete the full lifecycle of a link", async ({ page }) => {
    // 设置较长的超时时间，以应对 AI 生成和分页导出的网络延迟
    test.setTimeout(120000);

    // 访问首页并等待自动登录完成
    console.log("Step 1: 访问首页...");
    await page.goto("/");
    await page.waitForTimeout(3000); // 等待本地存储加载或重定向

    // 1. 创建链接
    console.log("Step 2: 打开新建链接对话框...");
    await page.click('button:has-text("新建链接"), button:has-text("Create Link")');
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    
    const uniqueUrl = `https://github.com/google/ds-test-${Date.now()}`;
    await page.fill('#originalUrl', uniqueUrl);
    
    // 随机生成短码
    console.log("Step 3: 随机生成短码...");
    await page.click('button:has-text("随机生成"), button:has-text("Generate")');
    const shortCode = await page.inputValue('#shortCode');
    expect(shortCode.length).toBeGreaterThan(0);

    // 测试 AI SEO 生成及其面板联动
    await page.fill('#description', "这是一个用于自动化测试的示例链接。互为螺旋加速器实战演示。");
    
    const aiBtn = page.locator('button:has-text("智能生成")');
    if (await aiBtn.isVisible()) {
      console.log("Step 4: 测试 AI SEO 智能生成与面板联动...");
      await aiBtn.click();
      
      // 确认“社交分享”面板已自动展开 (通过检查折叠项状态或文本可见性)
      await expect(page.locator('text=社交分享, text=Social Share')).toBeVisible();
      
      // 等待 AI 填充文本 (SEO 标题不应为空)
      await expect(page.locator('#seoTitle')).not.toBeEmpty({ timeout: 20000 });
    }

    console.log("Step 5: 提交表单...");
    await page.click('button[type="submit"]');

    // 确认成功提示
    await expect(page.locator('text=操作成功, text=Success')).toBeVisible({ timeout: 15000 });

    // 2. 编辑链接
    console.log("Step 6: 在表格中定位并编辑链接...");
    // 确保列表刷新且能看到新短码
    await expect(page.locator(`text=${shortCode}`)).toBeVisible({ timeout: 10000 });
    
    const row = page.locator(`tr:has-text("${shortCode}")`);
    await row.locator('button').last().click(); // 打开操作菜单
    await page.click('text=编辑链接, text=Edit Link');

    // 修改描述
    await page.fill('#description', "通过自动化测试更新了描述内容");
    await page.click('button[type="submit"]');
    await expect(page.locator('text=操作成功, text=Success')).toBeVisible();

    // 3. 分页导出
    console.log("Step 7: 测试分页导出逻辑...");
    await page.click('button:has-text("导出"), button:has-text("Export")');
    
    // 检查进度提示 (导出大文件时会有百分比/数量提示)
    await expect(page.locator('text=正在导出数据, text=正在准备导出')).toBeVisible();
    await expect(page.locator('text=导出已完成, text=Export completed')).toBeVisible({ timeout: 30000 });
    
    console.log("✅ 核心流程测试顺利完成。");
  });
});
