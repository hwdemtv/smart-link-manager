# Smart Link Manager SEO 优化实施方案

> 版本: 1.1
> 更新日期: 2026-03-25
> 状态: ✅ 已实施

---

## 一、SEO 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    SEO 优化层次架构                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础设施层                                         │
│  ├── robots.txt (爬虫规则)                                   │
│  ├── sitemap.xml (站点地图)                                  │
│  └── SSL/HTTPS (已具备)                                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 页面层                                             │
│  ├── 首页 SEO (Meta 标签)                                    │
│  ├── 短链预览页 (OG 标签 + JSON-LD)                          │
│  └── 错误页 SEO                                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 重定向策略层                                       │
│  ├── 301 永久重定向 (SEO 权重传递)                           │
│  ├── 302 临时重定向 (默认，不传递权重)                        │
│  └── 用户可选配置                                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 高级功能层                                         │
│  ├── 自定义 SEO 字段 (已有)                                  │
│  ├── 密码保护链接 SEO 隔离                                   │
│  └── AI SEO 建议 (已有 aiSeoService)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、当前 SEO 实现状态

### ✅ 已实现

| 功能 | 实现状态 | 位置 |
|------|---------|------|
| 机器人检测 | ✅ 支持 30+ 爬虫 | `server/deviceDetector.ts` |
| Open Graph 标签 | ✅ og:title/desc/image/url | `server/redirectHandler.ts` |
| Twitter Card | ✅ summary_large_image | `server/redirectHandler.ts` |
| 自定义 SEO 字段 | ✅ seoTitle/seoDescription/seoImage | `drizzle/schema.ts` |
| 密码保护隐藏 | ✅ 不泄露真实 URL | `server/redirectHandler.ts` |
| XSS 防护 | ✅ HTML 转义 | `server/redirectHandler.ts` |
| Canonical 标签 | ✅ 仅非密码保护链接 | `server/redirectHandler.ts` |

### ❌ 待实现 → ✅ 已实现

| 功能 | 重要性 | 说明 |
|------|--------|------|
| robots.txt | ✅ 已实现 | `server/seoHandler.ts` |
| sitemap.xml | ✅ 已实现 | `server/seoHandler.ts` |
| JSON-LD 结构化数据 | ✅ 已实现 | `server/redirectHandler.ts` |
| Meta Keywords | 🟢 低 | 现代 SEO 已不太重要 |
| 重定向类型可选 | ✅ 已实现 | 数据库字段 `redirectType` |

---

## 三、详细实施计划

### Phase 1: 基础设施层 (优先级: 🔴 高)

#### 1.1 robots.txt

**文件路径**: 动态生成路由 `/robots.txt`

**实现方案**:

```typescript
// server/seoHandler.ts
export function handleRobotsTxt(req: Request, res: Response) {
  const host = req.get('host');
  const protocol = req.protocol;

  const robotsTxt = `# Smart Link Manager robots.txt
User-agent: *
Allow: /s/
Disallow: /verify/
Disallow: /api/
Disallow: /qr/
Disallow: /dashboard
Disallow: /links
Disallow: /domains
Disallow: /settings

# 允许社交平台爬虫预览
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

# 中文搜索引擎
User-agent: Baiduspider
Allow: /s/

User-agent: Sogou
Allow: /s/

User-agent: 360Spider
Allow: /s/

# Sitemap 位置
Sitemap: ${protocol}://${host}/sitemap.xml
`;

  res.type('text/plain').send(robotsTxt);
}
```

---

#### 1.2 sitemap.xml

**路由**: `/sitemap.xml`

**挑战**: 短链数量可能很大，需要分片

**方案**: 动态生成 + 缓存 + 分页

```typescript
// server/seoHandler.ts
import { db } from './db';
import { links } from '../drizzle/schema';
import { eq, and, isNull, gt } from 'drizzle-orm';

const SITEMAP_PAGE_SIZE = 50000; // 单文件最大 URL 数

export async function handleSitemap(req: Request, res: Response) {
  const host = req.get('host');
  const protocol = req.protocol;
  const baseUrl = `${protocol}://${host}`;

  // 只索引活跃、有效、非删除、非密码保护的链接
  const activeLinks = await db
    .select({
      shortCode: links.shortCode,
      updatedAt: links.updatedAt,
      seoPriority: links.seoPriority,
    })
    .from(links)
    .where(
      and(
        eq(links.isActive, true),
        eq(links.isValid, true),
        isNull(links.deletedAt),
        isNull(links.passwordHash) // 密码保护链接不索引
      )
    )
    .limit(SITEMAP_PAGE_SIZE);

  const urls = activeLinks
    .map(link => {
      const priority = (link.seoPriority || 80) / 100;
      const lastmod = link.updatedAt
        ? new Date(link.updatedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      return `  <url>
    <loc>${baseUrl}/s/${link.shortCode}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
    })
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  res.type('application/xml').send(sitemap);
}
```

---

### Phase 2: 页面层优化 (优先级: 🔴 高)

#### 2.1 短链预览页增强 - JSON-LD

**当前**: OG 标签 + Twitter Card

**新增**: JSON-LD 结构化数据

在 `redirectHandler.ts` 的 SEO 渲染部分添加：

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "${title}",
  "description": "${description}",
  "url": "${shortUrl}",
  "image": "${image}",
  "mainEntity": {
    "@type": "WebPage",
    "url": "${originalUrl}"
  },
  "potentialAction": {
    "@type": "ViewAction",
    "target": "${originalUrl}"
  }
}
</script>
```

**密码保护链接特殊处理**:

```json
{
  "@type": "WebPage",
  "name": "受保护的链接",
  "description": "此链接需要密码验证",
  "isAccessibleForFree": false
}
```

---

#### 2.2 首页 SEO 优化

**当前问题**: `client/index.html` 只有基础 title

**优化方案**:

```html
<!-- 首页应包含 -->
<title>Smart Link Manager - 智能短链接管理平台</title>
<meta name="description" content="专业的短链接生成、点击追踪与数据分析平台。支持自定义域名、二维码生成、A/B测试等功能。">
<meta name="keywords" content="短链接,短网址,URL缩短,二维码,链接管理,点击统计">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Smart Link Manager - 智能短链接管理平台">
<meta property="og:description" content="专业的短链接生成、点击追踪与数据分析平台">
<meta property="og:image" content="/og-image.png">

<!-- JSON-LD -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Smart Link Manager",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CNY"
  }
}
</script>
```

---

### Phase 3: 重定向策略层 (优先级: 🟡 中)

#### 3.1 用户可选重定向类型

**SEO 影响**:

| 类型 | SEO 权重 | 适用场景 |
|------|---------|---------|
| 301 | ✅ 传递 | 永久迁移、品牌短链 |
| 302 | ❌ 不传递 | 活动链接、临时跳转 |
| 307 | ❌ 不传递 | 保持请求方法 |
| 308 | ✅ 传递 | 保持请求方法 |

---

#### 3.2 Canonical 标签策略

**当前**: 已实现，但仅非密码保护链接

**优化**: 添加 alternate 标签支持多语言

```html
<link rel="canonical" href="${originalUrl}">
<link rel="alternate" hreflang="zh" href="${shortUrl}">
<link rel="alternate" hreflang="en" href="${shortUrl}">
```

---

### Phase 4: 数据库 Schema 扩展

```sql
-- SEO 相关字段扩展
ALTER TABLE links ADD COLUMN seoPriority INT DEFAULT 80;      -- sitemap priority (0-100)
ALTER TABLE links ADD COLUMN noIndex INT DEFAULT 0;           -- 1 = noindex
ALTER TABLE links ADD COLUMN redirectType VARCHAR(10) DEFAULT '302';  -- 301/302/307/308
ALTER TABLE links ADD COLUMN seoKeywords TEXT;                -- SEO 关键词
ALTER TABLE links ADD COLUMN canonicalUrl VARCHAR(500);       -- 自定义 canonical
ALTER TABLE links ADD COLUMN ogVideoUrl VARCHAR(500);         -- 视频预览
ALTER TABLE links ADD COLUMN ogVideoWidth INT DEFAULT 1200;
ALTER TABLE links ADD COLUMN ogVideoHeight INT DEFAULT 630;
```

---

## 四、实施时间表

| 阶段 | 任务 | 工作量 | 优先级 | 状态 |
|------|------|--------|--------|------|
| **Phase 1.1** | robots.txt 动态生成 | 2h | 🔴 高 | ✅ 已完成 |
| **Phase 1.2** | sitemap.xml 动态生成 | 4h | 🔴 高 | ✅ 已完成 |
| **Phase 2.1** | JSON-LD 结构化数据 | 2h | 🔴 高 | ✅ 已完成 |
| **Phase 2.2** | 首页 SEO 优化 | 2h | 🟡 中 | ✅ 已完成 |
| **Phase 3.1** | 重定向类型可选 | 3h | 🟡 中 | ✅ 已完成 |
| **Phase 3.2** | 多语言标签 | 1h | 🟢 低 | ⬜ 待开始 |
| **Phase 4** | 数据库扩展 | 2h | 🟡 中 | ✅ 已完成 |

**总计**: 约 14 小时 (已完成)

---

## 五、预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 搜索引擎收录 | ❌ 无 | ✅ 可收录 |
| 社交分享预览 | ✅ 基础 | ✅ 完整 |
| 富媒体搜索结果 | ❌ 无 | ✅ JSON-LD |
| SEO 权重控制 | ❌ 无 | ✅ 可配置 |
| 索引控制 | ❌ 无 | ✅ noIndex |
| sitemap 提交 | ❌ 无 | ✅ 支持 |

---

## 六、技术要点

### 6.1 短链接 SEO 特殊性

短链接本质是"重定向"，搜索引擎处理方式：

```
用户访问 /s/abc123 → 重定向 → 目标 URL
```

- **Google**: 301 传递 PageRank，302 不传递
- **微信/社交平台**: 读取 OG 标签进行预览
- **当前使用 302**: 短链页面本身不会积累 SEO 权重

### 6.2 密码保护链接处理

- 不出现在 sitemap 中
- noindex 标签
- OG 标签不显示真实 URL
- JSON-LD 标记 `isAccessibleForFree: false`

### 6.3 自定义域名支持

- robots.txt 和 sitemap.xml 需要根据请求域名动态生成
- 支持多域名独立 SEO 配置

---

## 七、相关文件

- `server/redirectHandler.ts` - 短链重定向与 SEO 渲染
- `server/deviceDetector.ts` - 爬虫检测
- `server/seoHandler.ts` - (待创建) robots.txt / sitemap.xml
- `drizzle/schema.ts` - 数据库 Schema
- `client/index.html` - 首页 HTML
