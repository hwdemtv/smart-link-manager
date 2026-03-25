import { Request, Response } from "express";
import {
  getLinkByShortCode,
  updateLinkClickCount,
  recordLinkStat,
  recordUsage,
} from "./db";
import { detectDevice, isBot } from "./deviceDetector";
import { logger } from "./_core/logger";
import { resolveGeoIp } from "./geoIpResolver";
import { authService } from "./_core/sdk";
import { Link } from "../drizzle/schema";
import * as QRCode from "qrcode";

// QR 码缓存 - 缓存生成的 QR Data URL
const qrCache = new Map<string, { dataUrl: string; expiresAt: number }>();
const QR_CACHE_TTL_MS = 5 * 60 * 1000; // 5分钟缓存

/**
 * 日志脱敏工具：掩码解析 IP (例如 192.168.1.1 -> 192.168.1.*)
 */
function maskIp(ip: string | undefined): string {
  if (!ip) return "0.0.0.0";
  // 处理 IPv6 和 IPv4
  if (ip.includes(":")) return ip.substring(0, ip.lastIndexOf(":")) + ":*";
  return ip.substring(0, ip.lastIndexOf(".")) + ".*";
}

/**
 * 内容截断工具：防止过长 UA 撑爆日志
 */
function truncateUa(ua: string | undefined, length: number = 100): string {
  if (!ua) return "unknown";
  return ua.length > length ? ua.substring(0, length) + "..." : ua;
}

/**
 * 生成 QR 码 Data URL（带缓存）
 */
async function getQRDataUrl(url: string): Promise<string> {
  const now = Date.now();
  const cached = qrCache.get(url);
  if (cached && cached.expiresAt > now) {
    return cached.dataUrl;
  }

  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    type: "image/png",
    margin: 1,
    width: 256,
    color: { dark: "#111827", light: "#ffffff" },
  });

  // 清理过期缓存
  if (qrCache.size > 1000) {
    for (const [key, value] of qrCache.entries()) {
      if (value.expiresAt < now) qrCache.delete(key);
    }
    
    // 绝对上限防御：即使全部未过期，超过 2000 强制清空防止 OOM
    if (qrCache.size > 2000) {
      qrCache.clear();
      logger.warn("[QR Cache] Cache size exceeded absolute limit (2000), force cleared to prevent OOM.");
    }
  }

  qrCache.set(url, { dataUrl, expiresAt: now + QR_CACHE_TTL_MS });
  return dataUrl;
}

/**
 * 服务端渲染页面翻译字典
 */
const SSR_TRANSLATIONS = {
  zh: {
    title: "扫码安全访问",
    subtitle: "出于安全考虑，请使用手机相机扫描二维码进行访问",
    copyBtn: "复制地址",
    copySuccess: "链接已复制",
    footer: "安全验证中心 · Smart Link Manager",
  },
  en: {
    title: "Scan to Visit",
    subtitle: "For security, please scan the QR code with your phone camera",
    copyBtn: "Copy Link",
    copySuccess: "Link Copied",
    footer: "Security Center · Smart Link Manager",
  },
};

/**
 * 服务端渲染 QR 验证页面（极速响应，跳过前端加载）
 */
async function renderQRPage(
  res: Response,
  shortCode: string,
  fullUrl: string,
  lng: "zh" | "en" = "zh"
): Promise<void> {
  const qrDataUrl = await getQRDataUrl(fullUrl);
  const escapedUrl = escapeHtml(fullUrl);
  const t = SSR_TRANSLATIONS[lng] || SSR_TRANSLATIONS.zh;

  res.status(200).send(
    `<!DOCTYPE html>
<html lang="${lng === "zh" ? "zh-CN" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - Smart Link Manager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .card {
      background: white;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
      max-width: 380px;
      width: 100%;
      overflow: hidden;
    }
    .gradient-bar {
      height: 4px;
      background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6);
    }
    .content {
      padding: 32px 24px;
      text-align: center;
    }
    .icon-wrap {
      width: 48px; height: 48px;
      background: #eff6ff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .icon-wrap svg { width: 24px; height: 24px; color: #3b82f6; }
    h1 {
      font-size: 22px; font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px; color: #64748b;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .qr-wrap {
      padding: 16px;
      background: #f8fafc;
      border-radius: 16px;
      display: inline-block;
      margin-bottom: 20px;
    }
    .qr-wrap img {
      width: 200px; height: 200px;
      border-radius: 8px;
    }
    .link-box {
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 16px;
      word-break: break-all;
      font-size: 13px;
      color: #475569;
      font-family: ui-monospace, monospace;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      background: #0f172a;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #1e293b; }
    .btn svg { width: 16px; height: 16px; }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 11px;
      color: #94a3b8;
    }
    .footer .dot {
      width: 6px; height: 6px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #0f172a;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 100;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="gradient-bar"></div>
    <div class="content">
      <div class="icon-wrap">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      </div>
      <h1>${t.title}</h1>
      <p class="subtitle">${t.subtitle}</p>

      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR Code" />
      </div>

      <div class="link-box">${escapedUrl}</div>

      <button class="btn" onclick="copyLink()">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        ${t.copyBtn}
      </button>

      <div class="footer">
        <span class="dot"></span>
        <span>${t.footer}</span>
      </div>
    </div>
  </div>

  <div id="toast" class="toast">${t.copySuccess}</div>

  <script>
    function copyLink() {
      var url = "${escapedUrl}";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showToast).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast();
      }
      function showToast() {
        var t = document.getElementById('toast');
        t.classList.add('show');
        setTimeout(function() { t.classList.remove('show'); }, 2000);
      }
    }
  </script>
</body>
</html>`
  );
}

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
    const botResult = isBot(userAgent);

    logger.info(
      `[短链跳转] 执行决策: Code=${shortCode}, Type=${deviceInfo.type}, Bot=${botResult}, IP=${maskIp(req.ip)}, UA=${truncateUa(userAgent)}`
    );

    // Handle SEO for bots
    if (botResult) {
      logger.info(
        `[SEO] 识别为机器人: ${truncateUa(userAgent)}。渲染深度 Meta 标签。`
      );

      // 安全加固：如果设有访问密码，SEO 预览不应包含真实目标 URL，防止鉴权绕过
      const isProtected = !!link.passwordHash;

      // noIndex 检查：如果设置了 noIndex 或是密码保护，则禁止索引
      const shouldNoIndex = link.noIndex === 1 || isProtected;

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

      // 视频预览支持
      const ogVideo = link.ogVideoUrl ? {
        url: escapeHtml(link.ogVideoUrl),
        width: link.ogVideoWidth || 1200,
        height: link.ogVideoHeight || 630,
      } : null;

      // 如果受保护，则不向 Bot 展示真实 URL
      const displayUrl = isProtected
        ? currentUrl
        : escapeHtml(link.originalUrl);
      const jsonOriginalUrl = isProtected ? "" : escapeJson(link.originalUrl);

      // Canonical URL：优先使用自定义 canonical，否则使用原始 URL
      const canonicalUrl = link.canonicalUrl
        ? escapeHtml(link.canonicalUrl)
        : displayUrl;

      // JSON-LD 结构化数据
      const jsonLd = isProtected
        ? JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Protected Link",
            "description": "This link is password protected",
            "url": currentUrl,
            "isAccessibleForFree": false,
          })
        : JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "description": description,
            "url": currentUrl,
            ...(image && { image }),
            "mainEntity": {
              "@type": "WebPage",
              "url": link.originalUrl,
            },
            "potentialAction": {
              "@type": "ViewAction",
              "target": link.originalUrl,
            },
          });

      return res.status(200).send(
        `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${!shouldNoIndex ? `<link rel="canonical" href="${canonicalUrl}">` : ""}
  ${shouldNoIndex ? `<meta name="robots" content="noindex, nofollow">` : ""}

  <!-- Open Graph / Facebook / WeChat -->
  <meta property="og:type" content="${ogVideo ? 'video' : 'website'}">
  <meta property="og:url" content="${currentUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  ${image ? `<meta property="og:image" content="${image}">` : ""}
  <meta property="og:site_name" content="Smart Link Manager">
  ${ogVideo ? `
  <meta property="og:video" content="${ogVideo.url}">
  <meta property="og:video:width" content="${ogVideo.width}">
  <meta property="og:video:height" content="${ogVideo.height}">
  <meta property="og:video:type" content="video/mp4">
  ` : ""}

  <!-- Twitter -->
  <meta name="twitter:card" content="${ogVideo ? 'player' : 'summary_large_image'}">
  <meta name="twitter:url" content="${currentUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  ${image ? `<meta name="twitter:image" content="${image}">` : ""}
  ${ogVideo ? `
  <meta name="twitter:player" content="${ogVideo.url}">
  <meta name="twitter:player:width" content="${ogVideo.width}">
  <meta name="twitter:player:height" content="${ogVideo.height}">
  ` : ""}

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">${jsonLd}</script>

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

    // Get IP with fallback
    const ipAddress = (req.ip || req.connection.remoteAddress || "0.0.0.0") as string;

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
    // 异步执行统计更新与 GeoIP 解析，避免阻塞跳转响应
    Promise.all([
      updateLinkClickCount(link.id),
      (async () => {
        // 在后台解析 GeoIP (不阻塞重定向)
        const geoInfo = await resolveGeoIp(ipAddress);
        return recordLinkStat({
          linkId: link.id,
          userAgent,
          deviceType: deviceInfo.type,
          osName: deviceInfo.os,
          browserName: deviceInfo.browser,
          ipAddress,
          country: geoInfo.country,
          city: geoInfo.city,
          referer: (req.headers as any).referer,
          variant: variantHit,
        });
      })(),
      recordUsage({
        userId: link.userId,
        date: new Date().toISOString().split("T")[0],
        totalClicks: 1,
      }),
    ]).catch(err => logger.error("[统计写入失败]", err));

    // 获取用户配置的重定向类型，默认 302
    // 301/308 = 永久重定向 (SEO 权重传递)
    // 302/307 = 临时重定向 (不传递 SEO 权重)
    const redirectType = (link.redirectType || "302") as "301" | "302" | "307" | "308";
    const redirectCode = parseInt(redirectType, 10) as 301 | 302 | 307 | 308;

    // Handle redirect based on device type
    if (
      (deviceInfo.type === "mobile" || deviceInfo.type === "tablet") &&
      !link.passwordHash
    ) {
      // Mobile/tablet and NO password: Direct redirect
      return res.redirect(redirectCode, targetUrl);
    } else if (link.passwordHash) {
      // Any device with password: Show frontend verification page (needs password input)
      const visitorToken = await authService.createVisitorToken(shortCode);
      const verifyPageUrl = `/verify/${visitorToken}`;
      return res.redirect(302, verifyPageUrl); // 密码验证页始终使用 302
    } else {
      // Desktop without password: Server-side render QR page (FAST!)
      const baseUrl = link.customDomain
        ? `https://${link.customDomain}`
        : `${req.protocol}://${req.get("host")}`;
      const fullUrl = `${baseUrl}/s/${shortCode}`;

      // Detect language from headers
      const acceptLanguage = req.headers["accept-language"] || "";
      const lng = acceptLanguage.toLowerCase().includes("zh") ? "zh" : "en";

      return renderQRPage(res, shortCode, fullUrl, lng as "zh" | "en");
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
