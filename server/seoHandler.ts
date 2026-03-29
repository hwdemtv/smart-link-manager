import { Request, Response } from "express";
import { getDb } from "./db";
import { links } from "../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { logger } from "./_core/logger";

/**
 * 清理域名中的端口号
 */
function cleanDomain(domain: string | null | undefined): string {
  if (!domain) return "";
  return domain.replace(/^https?:\/\//, "").split(":")[0].replace(/\/+$/, "");
}

/**
 * SEO Handler - 处理 robots.txt 和 sitemap.xml
 */

// sitemap 单文件最大 URL 数 (Google 限制单文件 50000 URL)
const SITEMAP_PAGE_SIZE = 50000;

// sitemap 缓存 (5分钟)
let sitemapCache: { xml: string; expiresAt: number } | null = null;
const SITEMAP_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 处理 robots.txt 请求
 * 动态生成，支持自定义域名
 */
export function handleRobotsTxt(req: Request, res: Response) {
  const host = req.get("host") || "localhost";
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  const robotsTxt = `# Smart Link Manager robots.txt
# Generated at ${new Date().toISOString()}

User-agent: *
Allow: /s/
Disallow: /verify/
Disallow: /api/
Disallow: /qr/
Disallow: /dashboard
Disallow: /links
Disallow: /domains
Disallow: /settings
Disallow: /admin

# 允许社交平台爬虫预览短链
User-agent: facebookexternalhit
Allow: /s/

User-agent: Twitterbot
Allow: /s/

User-agent: LinkedInBot
Allow: /s/

User-agent: WhatsApp
Allow: /s/

User-agent: TelegramBot
Allow: /s/

User-agent: Slackbot
Allow: /s/

User-agent: Discordbot
Allow: /s/

# 中文搜索引擎
User-agent: Baiduspider
Allow: /s/

User-agent: Sogou
Allow: /s/

User-agent: 360Spider
Allow: /s/

User-agent: YisouSpider
Allow: /s/

# 国际搜索引擎
User-agent: Googlebot
Allow: /s/

User-agent: Bingbot
Allow: /s/

User-agent: Slurp
Allow: /s/

# Sitemap 位置
Sitemap: ${baseUrl}/sitemap.xml
`;

  res.type("text/plain; charset=utf-8");
  res.send(robotsTxt);
}

/**
 * 处理 sitemap.xml 请求
 * 动态生成活跃、有效、非密码保护的短链
 * 包含缓存机制以减轻数据库压力
 */
export async function handleSitemap(req: Request, res: Response) {
  try {
    const host = req.get("host") || "localhost";
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    // 检查缓存
    const now = Date.now();
    if (sitemapCache && sitemapCache.expiresAt > now) {
      logger.info(`[SEO] sitemap.xml 命中缓存，剩余 ${(sitemapCache.expiresAt - now) / 1000}s`);
      res.type("application/xml; charset=utf-8");
      res.send(sitemapCache.xml);
      return;
    }

    // 获取数据库连接
    const db = await getDb();
    if (!db) {
      throw new Error("Database not connected");
    }

    // 使用原始 SQL 查询，仅选择存在的列
    // TODO: 执行 drizzle/add-seo-fields.sql 后可启用 seoPriority
    const activeLinks = await db.execute(sql`
      SELECT
        shortCode,
        updatedAt,
        customDomain
      FROM links
      WHERE isActive = 1
        AND isValid = 1
        AND deletedAt IS NULL
        AND passwordHash IS NULL
      ORDER BY clickCount DESC
      LIMIT ${SITEMAP_PAGE_SIZE}
    `);

    logger.info(`[SEO] sitemap.xml 生成 ${activeLinks.length} 个链接`);

    // Drizzle execute 返回的是 ResultSetHeader，需要获取 rows
    // @ts-ignore - Drizzle execute 返回格式
    const rows = activeLinks[0] || activeLinks;

    // 1. 生成静态核心页面 URL
    const staticRows = [
      { loc: baseUrl, priority: "1.0", changefreq: "daily" },
      { loc: `${baseUrl}/about`, priority: "0.5", changefreq: "monthly" },
      { loc: `${baseUrl}/terms`, priority: "0.3", changefreq: "monthly" },
      { loc: `${baseUrl}/privacy`, priority: "0.3", changefreq: "monthly" },
      { loc: `${baseUrl}/docs/api`, priority: "0.7", changefreq: "weekly" },
      { loc: `${baseUrl}/docs/security`, priority: "0.7", changefreq: "weekly" },
      { loc: `${baseUrl}/docs/changelog`, priority: "0.6", changefreq: "weekly" },
      { loc: `${baseUrl}/docs/contact`, priority: "0.6", changefreq: "weekly" },
    ];

    const staticUrls = staticRows.map(route => `  <url>
    <loc>${escapeXml(route.loc)}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join("\n");

    // 2. 生成动态短链 URL
    const urls = (Array.isArray(rows) ? rows : [])
      .map((link: any) => {
        // 如果有自定义域名，使用自定义域名（清理端口号）
        const linkBaseUrl = link.customDomain
          ? `https://${cleanDomain(link.customDomain)}`
          : baseUrl;
        const loc = `${linkBaseUrl}/s/${link.shortCode}`;
        const lastmod = link.updatedAt
          ? new Date(link.updatedAt).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];
        // 默认优先级 0.8
        const priority = "0.8";

        return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
      })
      .join("\n");

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${urls}
</urlset>
`;

    // 更新缓存
    sitemapCache = {
      xml: sitemap,
      expiresAt: now + SITEMAP_CACHE_TTL_MS,
    };

    res.type("application/xml; charset=utf-8");
    res.send(sitemap);
  } catch (error) {
    logger.error("[SEO] sitemap.xml 生成失败:", error);
    res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`);
  }
}

/**
 * 清除 sitemap 缓存 (在链接创建/更新时调用)
 */
export function clearSitemapCache() {
  sitemapCache = null;
  logger.info("[SEO] sitemap 缓存已清除");
}

/**
 * XML 转义
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
