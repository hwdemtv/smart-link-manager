import { z } from "zod";

/**
 * 链接创建校验 Schema
 */
export const createLinkSchema = z.object({
  originalUrl: z.string().url("请输入有效的网址"),
  shortCode: z
    .string()
    .min(3, "短码至少 3 个字符")
    .max(20, "短码最多 20 个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "短码仅支持字母、数字、下划线和连字符"),
  customDomain: z.string().optional(),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
  password: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // SEO 基础字段
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoImage: z.string().optional(),
  // SEO 高级字段
  seoPriority: z.number().min(0).max(100).optional(),
  noIndex: z.number().min(0).max(1).optional(),
  redirectType: z.enum(["301", "302", "307", "308"]).optional(),
  seoKeywords: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  ogVideoUrl: z.string().url().optional(),
  ogVideoWidth: z.number().int().positive().optional(),
  ogVideoHeight: z.number().int().positive().optional(),
  // A/B 测试
  abTestEnabled: z.number().min(0).max(1).optional(),
  abTestUrl: z.string().url().optional(),
  abTestRatio: z.number().min(1).max(99).optional(),
  groupId: z.number().nullable().optional(),
  // 社交分享
  shareSuffix: z.string().max(100).optional(),
});

/**
 * 链接更新校验 Schema
 */
export const updateLinkSchema = z.object({
  linkId: z.number(),
  originalUrl: z.string().url("请输入有效的网址").optional(),
  shortCode: z
    .string()
    .min(3, "短码至少 3 个字符")
    .max(20, "短码最多 20 个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "短码仅支持字母、数字、下划线和连字符")
    .optional(),
  customDomain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.number().min(0).max(1).optional(),
  expiresAt: z.date().nullable().optional(),
  password: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  // SEO 基础字段
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoImage: z.string().nullable().optional(),
  shareSuffix: z.string().max(255).nullable().optional(),
  // SEO 高级字段
  seoPriority: z.number().min(0).max(100).nullable().optional(),
  noIndex: z.number().min(0).max(1).nullable().optional(),
  redirectType: z.enum(["301", "302", "307", "308"]).nullable().optional(),
  seoKeywords: z.string().nullable().optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  ogVideoUrl: z.string().url().nullable().optional(),
  ogVideoWidth: z.number().int().positive().nullable().optional(),
  ogVideoHeight: z.number().int().positive().nullable().optional(),
  // A/B 测试
  abTestEnabled: z.number().min(0).max(1).optional(),
  abTestUrl: z.string().url().nullable().optional(),
  abTestRatio: z.number().min(1).max(99).optional(),
  groupId: z.number().nullable().optional(),
});

/**
 * 链接搜索过滤校验 Schema
 */
export const searchLinksSchema = z.object({
  query: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(["all", "active", "invalid"]).optional(),
  orderBy: z.enum(["createdAt", "clickCount", "updatedAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  groupId: z.number().nullable().optional(),
});
