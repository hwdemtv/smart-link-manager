import express from "express";
import { z } from "zod";
import { apiKeyService } from "./apiKeyService";
import { createLink, getLinkByShortCode, getLinksByUserId, getLinkById, updateLink, deleteLink } from "./db";
import { logger } from "./_core/logger";
import { hashPassword } from "./_core/auth";

const router = express.Router();

// REST API 内存限速器（每 IP 每分钟 60 次）
const restRateStore = new Map<string, { count: number; resetTime: number }>();
const REST_RATE_LIMIT = 60;
const REST_WINDOW_MS = 60 * 1000;
const REST_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟清理一次
const MAX_RATE_STORE_SIZE = 10000; // 内存 Map 最大容量硬上限

// 定期清理过期条目，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [ip, entry] of restRateStore) {
    if (now > entry.resetTime) {
      restRateStore.delete(ip);
      cleaned++;
    }
  }
  if (cleaned > 100) {
    logger.info(`[REST RateLimiter] Cleaned up ${cleaned} expired entries`);
  }
}, REST_CLEANUP_INTERVAL_MS);

function restRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.ip ||
    "unknown";
  const now = Date.now();
  const entry = restRateStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // 内存熔断防御：防止恶意海量 IP 消耗内存
    if (!entry && restRateStore.size >= MAX_RATE_STORE_SIZE) {
      logger.warn(`[REST RateLimiter] Store reached absolute limit (${MAX_RATE_STORE_SIZE}), dropping new IP tracking.`);
      return next(); // 容错处理：不拦截但也不记录，防止 OOM
    }
    restRateStore.set(ip, { count: 1, resetTime: now + REST_WINDOW_MS });
    return next();
  }

  entry.count++;
  if (entry.count > REST_RATE_LIMIT) {
    return res.status(429).json({
      error: "Too Many Requests",
      message: "API rate limit exceeded. Please slow down.",
    });
  }
  next();
}

/**
 * Middleware for API Key Authentication
 */
const apiKeyAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({
        error:
          "Missing or invalid Authorization header. Expected 'Bearer <key>'",
      });
  }

  const rawKey = authHeader.substring(7); // Remove 'Bearer '
  const identity = await apiKeyService.verifyKey(rawKey);

  if (!identity) {
    return res.status(401).json({ error: "Invalid or inactive API Key" });
  }

  req.user = { id: identity.userId };
  next();
};

// Apply rate limiting first, then API Key auth to all routes
router.use(restRateLimiter);
router.use(apiKeyAuth);

/**
 * GET /api/v1/links
 * List all links for the user
 */
router.get("/links", async (req: any, res) => {
  try {
    const links = await getLinksByUserId(req.user.id);
    res.json(links);
  } catch (error) {
    logger.error("[REST API] Failed to list links:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 通用链接输入验证 Schema
const linkInputSchema = z.object({
  originalUrl: z.string().url("Invalid originalUrl format").optional(),
  shortCode: z.string()
    .min(3, "shortCode must be at least 3 characters")
    .max(20, "shortCode cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "shortCode contains invalid characters")
    .optional(),
  description: z.string().optional().nullable(),
  isActive: z.number().int().min(0).max(1).optional().nullable(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
  password: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  groupId: z.number().int().optional().nullable(),
  // SEO & 社交分享
  shareSuffix: z.string().optional().nullable(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  seoImage: z.string().optional().nullable(),
  seoPriority: z.number().optional().nullable(),
  noIndex: z.number().int().optional().nullable(),
  redirectType: z.enum(["301", "302", "307", "308"]).optional().nullable(),
  seoKeywords: z.string().optional().nullable(),
  canonicalUrl: z.string().url().optional().nullable(),
  ogVideoUrl: z.string().url().optional().nullable(),
  ogVideoWidth: z.number().optional().nullable(),
  ogVideoHeight: z.number().optional().nullable(),
  // A/B 测试
  abTestEnabled: z.number().int().min(0).max(1).optional().nullable(),
  abTestUrl: z.string().url().optional().nullable(),
  abTestRatio: z.number().int().min(0).max(100).optional().nullable(),
});

/**
 * POST /api/v1/links
 * Create a new short link
 */
router.post("/links", async (req: any, res) => {
  const schemaWithRequired = linkInputSchema.extend({
    originalUrl: z.string().url("originalUrl is required"),
    shortCode: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  });

  const parseResult = schemaWithRequired.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ 
      error: "Validation failed", 
      details: parseResult.error.format() 
    });
  }

  const input = parseResult.data;

  try {
    const existing = await getLinkByShortCode(input.shortCode);
    if (existing) {
      return res.status(409).json({ error: "shortCode already exists" });
    }

    const passwordHash = input.password ? await hashPassword(input.password) : null;

    const newLink = await createLink({
      userId: req.user.id,
      originalUrl: input.originalUrl,
      shortCode: input.shortCode,
      description: input.description || null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      passwordHash,
      tags: input.tags || [],
      groupId: input.groupId || null,
      shareSuffix: input.shareSuffix || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      seoImage: input.seoImage || null,
      seoPriority: input.seoPriority || 0,
      noIndex: input.noIndex || 0,
      redirectType: input.redirectType || "302",
      seoKeywords: input.seoKeywords || null,
      canonicalUrl: input.canonicalUrl || null,
      ogVideoUrl: input.ogVideoUrl || null,
      ogVideoWidth: input.ogVideoWidth || 0,
      ogVideoHeight: input.ogVideoHeight || 0,
      abTestEnabled: input.abTestEnabled || 0,
      abTestUrl: input.abTestUrl || null,
      abTestRatio: input.abTestRatio || 50,
    });

    res.status(201).json(newLink);
  } catch (error) {
    logger.error("[REST API] Failed to create link:", error);
    if (error instanceof Error && error.message === "SHORT_CODE_EXISTS") {
      return res.status(409).json({ error: "shortCode already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/v1/links/:id
 * Update an existing link
 */
router.patch("/links/:id", async (req: any, res) => {
  const linkId = parseInt(req.params.id);
  if (isNaN(linkId)) {
    return res.status(400).json({ error: "Invalid link ID" });
  }

  const parseResult = linkInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Validation failed", details: parseResult.error.format() });
  }

  const input = parseResult.data;

  try {
    const link = await getLinkById(linkId);
    if (!link || link.userId !== req.user.id) {
      return res.status(404).json({ error: "Link not found" });
    }

    if (input.shortCode && input.shortCode !== link.shortCode) {
      const existing = await getLinkByShortCode(input.shortCode);
      if (existing) {
        return res.status(409).json({ error: "shortCode already exists" });
      }
    }

    const updateData: any = { ...input };
    if (input.password !== undefined) {
      updateData.passwordHash = input.password ? await hashPassword(input.password) : null;
      delete updateData.password;
    }
    if (input.expiresAt !== undefined) {
      updateData.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    }

    await updateLink(linkId, updateData);
    const updatedLink = await getLinkById(linkId);
    res.json(updatedLink);
  } catch (error) {
    logger.error("[REST API] Failed to update link:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/v1/links/:id
 * Delete a link
 */
router.delete("/links/:id", async (req: any, res) => {
  const linkId = parseInt(req.params.id);
  if (isNaN(linkId)) {
    return res.status(400).json({ error: "Invalid link ID" });
  }

  try {
    const link = await getLinkById(linkId);
    if (!link || link.userId !== req.user.id) {
      return res.status(404).json({ error: "Link not found" });
    }

    await deleteLink(linkId);
    res.json({ success: true, message: "Link deleted successfully" });
  } catch (error) {
    logger.error("[REST API] Failed to delete link:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
