import express from "express";
import { apiKeyService } from "./apiKeyService";
import { createLink, getLinkByShortCode, getLinksByUserId } from "./db";
import { logger } from "./_core/logger";

const router = express.Router();

/**
 * Middleware for API Key Authentication
 */
const apiKeyAuth = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header. Expected 'Bearer <key>'" });
  }

  const rawKey = authHeader.substring(7); // Remove 'Bearer '
  const identity = await apiKeyService.verifyKey(rawKey);

  if (!identity) {
    return res.status(401).json({ error: "Invalid or inactive API Key" });
  }

  req.user = { id: identity.userId };
  next();
};

// Apply auth to all routes in this router
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
  const { originalUrl, shortCode, description, expiresAt, password, tags, seoTitle, seoDescription, seoImage } = req.body;

  if (!originalUrl || !shortCode) {
    return res.status(400).json({ error: "originalUrl and shortCode are required" });
  }

  try {
    // Check if exists
    const existing = await getLinkByShortCode(shortCode);
    if (existing) {
      return res.status(409).json({ error: "shortCode already exists" });
    }

    const newLink = await createLink({
      userId: req.user.id,
      originalUrl,
      shortCode,
      description: description || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      passwordHash: password || undefined,
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
