import { Request, Response } from "express";
import { getLinkByShortCode, updateLinkClickCount, recordLinkStat } from "./db";
import { detectDevice } from "./deviceDetector";

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
      return res.status(404).json({ error: "Link not found or expired" });
    }

    // Check if link has expired
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Link has expired" });
    }

    // Detect device type
    const userAgent = req.headers["user-agent"] || "";
    const deviceInfo = detectDevice(userAgent);

    // Record click statistics
    await updateLinkClickCount(link.id);
    await recordLinkStat({
      linkId: link.id,
      userAgent,
      deviceType: deviceInfo.type,
      osName: deviceInfo.os,
      browserName: deviceInfo.browser,
      ipAddress: req.ip || req.connection.remoteAddress,
      referer: req.headers.referer,
    });

    // Handle redirect based on device type
    if (deviceInfo.type === "mobile" || deviceInfo.type === "tablet") {
      // Mobile/tablet: Direct redirect
      return res.redirect(302, link.originalUrl);
    } else {
      // Desktop: Show QR code page with link info
      const qrPageUrl = `/qr/${shortCode}?code=${encodeURIComponent(shortCode)}&url=${encodeURIComponent(link.originalUrl)}&desc=${encodeURIComponent(link.description || "")}`;
      return res.redirect(302, qrPageUrl);
    }
  } catch (error) {
    console.error("[Redirect Handler] Error:", error);
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
    console.error("[Get Redirect Target] Error:", error);
    return null;
  }
}
