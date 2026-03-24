import { Request, Response } from "express";
import {
  getLinkByShortCode,
  updateLinkClickCount,
  recordLinkStat,
  recordUsage,
} from "./db";
import { detectDevice } from "./deviceDetector";
import { logger } from "./_core/logger";
import { resolveGeoIp } from "./geoIpResolver";
import { Link } from "../drizzle/schema";

/**
 * HTML 转义函数 - 防止 XSS 攻击
 * 转义用户可控的 SEO 元数据字段
 */
function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, char => htmlEntities[char] || char);
}

/**
 * JSON 字符串转义 - 用于安全地嵌入 JSON-LD
 */
function escapeJson(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

// --- Simple In-Memory Cache for Short Links ---
const linkCache = new Map<string, { link: Link | null; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache TTL for high concurrency
const MAX_CACHE_SIZE = 10000; // 最大缓存条目数，防止内存溢出

async function getCachedLink(shortCode: string): Promise<Link | null> {
  const now = Date.now();
  const cached = linkCache.get(shortCode);
  if (cached && cached.expiresAt > now) {
    return cached.link;
  }

  const link = (await getLinkByShortCode(shortCode)) as Link | null;

  // LRU 缓存策略：超过最大条目数时删除最旧的条目
  if (linkCache.size >= MAX_CACHE_SIZE) {
    const firstKey = linkCache.keys().next().value;
    if (firstKey) {
      linkCache.delete(firstKey);
    }
  }

  // Cache both hit and miss (to prevent cache penetration) for 60s
  linkCache.set(shortCode, { link, expiresAt: now + CACHE_TTL_MS });
  return link;
}
// ----------------------------------------------

/**
 * Handle short link redirect with device detection
 * Mobile: Direct redirect to original URL
 * Desktop: Show QR code page
 */
export async function handleShortLinkRedirect(
  req: Request,
  res: Response,
  shortCode: string
) {
  try {
    // Get link from memory cache (or database if miss/expired)
    const link = await getCachedLink(shortCode);

    if (!link || !link.isActive || !link.isValid || link.deletedAt) {
      return res.redirect(302, "/error?type=NOT_FOUND");
    }

    // Check if link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.redirect(302, "/error?type=EXPIRED");
    }

    // Detect device type
    const userAgent = req.headers["user-agent"] || "";
    const deviceInfo = detectDevice(userAgent);
    const { isBot } = await import("./deviceDetector");

    // Handle SEO for bots
    if (isBot(userAgent)) {
      logger.info(
        `[SEO] Bot detected: ${userAgent}. Rendering deep Meta tags.`
      );

      // 安全加固：如果设有访问密码，SEO 预览不应包含真实目标 URL，防止鉴权绕过
      const isProtected = !!link.passwordHash;

      // 对用户可控字段进行 HTML 转义，防止 XSS
      const title = escapeHtml(link.seoTitle || "Smart Link Preview");
      const description = isProtected
        ? "此链接受密码保护，请验证后访问。"
        : escapeHtml(
            link.seoDescription ||
              link.description ||
              "Click to open this smart link."
          );
      const image = escapeHtml(link.seoImage || "");
      const currentUrl = escapeHtml(
        `${req.protocol}://${req.get("host")}${req.originalUrl}`
      );

      // 如果受保护，则不向 Bot 展示真实 URL
      const displayUrl = isProtected
        ? currentUrl
        : escapeHtml(link.originalUrl);
      const jsonOriginalUrl = isProtected ? "" : escapeJson(link.originalUrl);

      return res.status(200).send(
        `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${!isProtected ? `<link rel="canonical" href="${displayUrl}">` : ""}

  <!-- Open Graph / Facebook / WeChat -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="Smart Link Manager">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${currentUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  ${
    !isProtected
      ? `
  <meta http-equiv="refresh" content="0;url=${displayUrl}">
  <script>window.location.href = "${jsonOriginalUrl}";</script>
  `
      : ""
  }
</head>
<body>
  <div style="font-family: sans-serif; text-align: center; margin-top: 50px; padding: 20px;">
    <h2>${isProtected ? "🔒 此链接已加密" : "Redirecting..."}</h2>
    <p>${isProtected ? "请在浏览器中打开并输入正确密码以访问内容。" : `We are taking you to <a href="${displayUrl}">${displayUrl}</a>`}</p>
  </div>
</body>
</html>
      `.trim()
      );
    }

    // Resolve GeoIP if possible
    const ipAddress = req.ip || req.connection.remoteAddress;
    const geoInfo = await resolveGeoIp(ipAddress);

    // A/B 测试计算逻辑
    let targetUrl = link.originalUrl;
    let variantHit = "A"; // 默认走 A 路径

    if (link.abTestEnabled === 1 && link.abTestUrl) {
      // 随机分配概率 (0 - 99)
      const roll = Math.random() * 100;
      // 若 abTestRatio 为 50, 当 roll < 50 时走 A 路径，否则走 B 路径
      if (roll >= link.abTestRatio) {
        targetUrl = link.abTestUrl;
        variantHit = "B";
      }
    }

    // Record click statistics asynchronously (fire-and-forget)
    // 异步执行统计更新，避免高并发时的行锁争用阻塞跳转响应
    Promise.all([
      updateLinkClickCount(link.id),
      recordLinkStat({
        linkId: link.id,
        userAgent,
        deviceType: deviceInfo.type,
        osName: deviceInfo.os,
        browserName: deviceInfo.browser,
        ipAddress,
        country: geoInfo.country,
        city: geoInfo.city,
        referer: req.headers.referer,
        variant: variantHit,
      }),
      recordUsage({
        userId: link.userId,
        date: new Date().toISOString().split("T")[0],
        totalClicks: 1,
      }),
    ]).catch(err => logger.error("[统计写入失败]", err));

    // Handle redirect based on device type
    if (
      (deviceInfo.type === "mobile" || deviceInfo.type === "tablet") &&
      !link.passwordHash
    ) {
      // Mobile/tablet and NO password: Direct redirect
      return res.redirect(302, targetUrl);
    } else {
      // Desktop OR any device with password: Show Secure Verification Center with a visitor token
      const { authService } = await import("./_core/sdk");
      const visitorToken = await authService.createVisitorToken(shortCode);
      const verifyPageUrl = `/verify/${visitorToken}`;
      return res.redirect(302, verifyPageUrl);
    }
  } catch (error) {
    logger.error("[短链引擎跳转] 未知崩溃:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Get redirect target URL (for API endpoint)
 */
export async function getRedirectTarget(
  shortCode: string
): Promise<string | null> {
  try {
    const link = await getCachedLink(shortCode);

    if (!link || !link.isActive || !link.isValid) {
      return null;
    }

    // Check if link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return null;
    }

    return link.originalUrl;
  } catch (error) {
    logger.error("[获取真实目标路径] 探测失败:", error);
    return null;
  }
}
