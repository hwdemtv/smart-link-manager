/**
 * 链接管理集成测试
 * 测试从 API 层到数据库层的完整流程
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createMockContext } from "../../setupTests";
import { appRouter } from "../../routers";
import * as db from "../../db";
import { closeDb } from "../../db";

// 跳过这些测试如果没有配置测试数据库
const describeIfDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

describeIfDb("Links Integration Tests", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let testUserId: number;

  beforeAll(async () => {
    // 创建测试用户
    const mockCtx = createMockContext();
    caller = appRouter.createCaller(mockCtx);

    // 确保测试数据库连接
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL not configured");
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    // 清理测试数据
    // 这里应该清理之前测试创建的链接
  });

  describe("POST /api/trpc/links.create", () => {
    it("should create a new short link", async () => {
      const input = {
        originalUrl: "https://example.com/test",
        shortCode: `test_${Date.now()}`,
        description: "Test link",
      };

      const result = await caller.links.create(input);

      expect(result.success).toBe(true);
      expect(result.shortCode).toBe(input.shortCode);
      expect(result.fullUrl).toContain(input.shortCode);
    });

    it("should reject duplicate short codes", async () => {
      const shortCode = `dup_${Date.now()}`;
      const input = {
        originalUrl: "https://example.com/test",
        shortCode,
      };

      // 第一次创建应该成功
      await caller.links.create(input);

      // 第二次创建相同 shortCode 应该失败
      await expect(caller.links.create(input)).rejects.toThrow(/CONFLICT|已存在/);
    });

    it("should enforce quota limits", async () => {
      // 模拟免费用户已达到配额限制
      // 这需要 mock licenseService 或创建测试用户
    });
  });

  describe("GET /api/trpc/links.list", () => {
    it("should return user links with fullUrl", async () => {
      // 创建测试链接
      await caller.links.create({
        originalUrl: "https://example.com/list-test",
        shortCode: `list_${Date.now()}`,
      });

      const result = await caller.links.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty("fullUrl");
      expect(result[0]).toHaveProperty("shortCode");
    });
  });

  describe("PUT /api/trpc/links.update", () => {
    it("should update link properties", async () => {
      // 创建测试链接
      const createResult = await caller.links.create({
        originalUrl: "https://example.com/update-test",
        shortCode: `upd_${Date.now()}`,
      });

      // 获取链接 ID（这里假设 list 返回包含 ID）
      const links = await caller.links.list();
      const link = links.find((l) => l.shortCode === createResult.shortCode);

      if (!link) throw new Error("Link not found");

      // 更新链接
      const updateResult = await caller.links.update({
        linkId: link.id,
        description: "Updated description",
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.link.description).toBe("Updated description");
    });
  });

  describe("Soft Delete & Restore", () => {
    it("should soft delete and restore a link", async () => {
      // 创建测试链接
      const createResult = await caller.links.create({
        originalUrl: "https://example.com/delete-test",
        shortCode: `del_${Date.now()}`,
      });

      const links = await caller.links.list();
      const link = links.find((l) => l.shortCode === createResult.shortCode);
      if (!link) throw new Error("Link not found");

      // 软删除
      const deleteResult = await caller.links.softDelete({ linkId: link.id });
      expect(deleteResult.success).toBe(true);

      // 确认在回收站中
      const deletedLinks = await caller.links.getDeleted();
      expect(deletedLinks.some((l) => l.id === link.id)).toBe(true);

      // 恢复链接
      const restoreResult = await caller.links.restore({ linkId: link.id });
      expect(restoreResult.success).toBe(true);

      // 确认恢复到列表中
      const listAfterRestore = await caller.links.list();
      expect(listAfterRestore.some((l) => l.id === link.id)).toBe(true);
    });

    it("should handle concurrent restore conflict", async () => {
      // 测试并发恢复场景下的冲突处理
      // 这需要模拟两个请求同时尝试恢复使用相同短码的情况
    });
  });

  describe("Batch Operations", () => {
    it("should batch import links with conflict handling", async () => {
      const timestamp = Date.now();
      const input = {
        links: [
          {
            originalUrl: "https://example.com/batch1",
            shortCode: `batch1_${timestamp}`,
          },
          {
            originalUrl: "https://example.com/batch2",
            shortCode: `batch2_${timestamp}`,
          },
          // 故意创建冲突的短码
          {
            originalUrl: "https://example.com/batch3",
            shortCode: `batch1_${timestamp}`, // 重复
          },
        ],
      };

      const result = await caller.links.batchImport(input);

      expect(result.success.length).toBeGreaterThanOrEqual(2);
      expect(result.failed.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Short Link Redirect", () => {
    it("should track click statistics", async () => {
      // 创建测试链接
      const createResult = await caller.links.create({
        originalUrl: "https://example.com/stats-test",
        shortCode: `stats_${Date.now()}`,
      });

      const links = await caller.links.list();
      const link = links.find((l) => l.shortCode === createResult.shortCode);
      if (!link) throw new Error("Link not found");

      // 模拟点击（调用 recordClick）
      await caller.links.recordClick({
        shortCode: link.shortCode,
        userAgent: "Mozilla/5.0 Test",
        deviceType: "mobile",
      });

      // 获取统计数据
      const stats = await caller.links.getStatsSummary({ linkId: link.id });
      expect(stats.totalClicks).toBeGreaterThan(0);
    });
  });
});
