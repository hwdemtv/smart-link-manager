import { Request, Response } from "express";
import { getLinkByShortCode, updateLinkClickCount, recordLinkStat } from "./db";
import { detectDevice } from "./deviceDetector";
import { logger } from "./_core/logger";
import { resolveGeoIp } from "./geoIpResolver";

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
    // Get link from database
    const link = await getLinkByShortCode(shortCode);

    if (!link || !link.isActive || !link.isValid) {
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
      logger.info(`[SEO] Bot detected: ${userAgent}. Rendering deep Meta tags.`);
      const title = link.seoTitle || "Smart Link Preview";
      const description = link.seoDescription || link.description || "Click to open this smart link.";
      const image = link.seoImage || "";
      const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const originalUrl = link.originalUrl;

      return res.status(200).send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${originalUrl}">
  
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
  
  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "${title}",
    "description": "${description}",
    "url": "${currentUrl}",
    "image": "${image}"
  }
  </script>

  <meta http-equiv="refresh" content="0;url=${originalUrl}">
  <script>window.location.href = "${originalUrl}";</script>
</head>
<body>
  <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
    <h2>Redirecting...</h2>
    <p>We are taking you to <a href="${originalUrl}">${originalUrl}</a></p>
  </div>
</body>
</html>
      `.trim());
    }

    // Resolve GeoIP if possible
    const ipAddress = req.ip || req.connection.remoteAddress;
    const geoInfo = await resolveGeoIp(ipAddress);

    // Record click statistics
    await updateLinkClickCount(link.id);
    await recordLinkStat({
      linkId: link.id,
      userAgent,
      deviceType: deviceInfo.type,
      osName: deviceInfo.os,
      browserName: deviceInfo.browser,
      ipAddress,
      country: geoInfo.country,
      city: geoInfo.city,
      referer: req.headers.referer,
    });

    // Handle redirect based on device type
    if ((deviceInfo.type === "mobile" || deviceInfo.type === "tablet") && !link.passwordHash) {
      // Mobile/tablet and NO password: Direct redirect
      return res.redirect(302, link.originalUrl);
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
export async function getRedirectTarget(shortCode: string): Promise<string | null> {
  try {
    const link = await getLinkByShortCode(shortCode);

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
