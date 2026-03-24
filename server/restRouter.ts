import express from "express";
import { apiKeyService } from "./apiKeyService";
import { createLink, getLinkByShortCode, getLinksByUserId } from "./db";
import { logger } from "./_core/logger";
import { hashPassword } from "./_core/auth";

const router = express.Router();

// REST API 内存限速器（每 IP 每分钟 60 次）
const restRateStore = new Map<string, { count: number; resetTime: number }>();
const REST_RATE_LIMIT = 60;
const REST_WINDOW_MS = 60 * 1000;
const REST_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟清理一次

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

/**
 * POST /api/v1/links
 * Create a new short link
 */
router.post("/links", async (req: any, res) => {
  const {
    originalUrl,
    shortCode,
    description,
    expiresAt,
    password,
    tags,
    seoTitle,
    seoDescription,
    seoImage,
  } = req.body;

  if (!originalUrl || !shortCode) {
    return res
      .status(400)
      .json({ error: "originalUrl and shortCode are required" });
  }

  try {
    // Check if exists
    const existing = await getLinkByShortCode(shortCode);
    if (existing) {
      return res.status(409).json({ error: "shortCode already exists" });
    }

    // 密码哈希处理 - 与 tRPC 路由保持一致
    const passwordHash = password ? await hashPassword(password) : null;

    const newLink = await createLink({
      userId: req.user.id,
      originalUrl,
      shortCode,
      description: description || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      passwordHash,
      tags: tags || [],
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      seoImage: seoImage || null,
    });

    res.status(201).json(newLink);
  } catch (error) {
    logger.error("[REST API] Failed to create link:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
