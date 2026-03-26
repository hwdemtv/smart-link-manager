# 站点地图 (Sitemap)

> 最后更新：2026-03-26

---

## 1. 公开页面 (Public Pages)

| 页面 | 路径 | 描述 |
|------|------|------|
| 首页 | `/` | 平台门户与特性介绍 |
| 登录 | `/login` | 账户登录与注册 |
| FAQ | `/faq` | 常见问题解答 |

---

## 2. 学习中心 (Learning Center)

| 页面 | 路径 | 描述 |
|------|------|------|
| 什么是短链接？ | `/docs/what-is-url-shortener` | 短链接定义与工作原理 |
| 短链接工作原理 | `/docs/how-it-works` | 技术实现细节 |
| 短链接的优势 | `/docs/benefits` | 业务价值分析 |
| SEO 最佳实践 | `/docs/best-practices` | 搜索引擎优化指南 |
| API 开发手册 | `/docs/api-guide` | 开发者集成指南 |

---

## 3. 文档中心 (Documentation)

| 页面 | 路径 | 描述 |
|------|------|------|
| 关于我们 | `/docs/about` | 了解我们的愿景 |
| API 文档 | `/docs/api` | REST API 完整规范 |
| 安全中心 | `/docs/security` | 安全防护机制白皮书 |
| 更新日志 | `/docs/changelog` | 版本迭代历史 |
| SEO & GEO 报告 | `/docs/seo-geo-report` | 优化成果报告 |
| 联系我们 | `/docs/contact` | 企业咨询与商务合作 |

---

## 4. 法律合规 (Legal)

| 页面 | 路径 | 描述 |
|------|------|------|
| 服务协议 | `/docs/terms` | 使用条款与规范 |
| 隐私政策 | `/docs/privacy` | 数据保护承诺 |

---

## 5. 管理面板 (Dashboard)

> 以下页面需要登录后访问

| 页面 | 路径 | 描述 |
|------|------|------|
| 仪表盘 | `/dashboard` | 实时数据概览 |
| 链接管理 | `/dashboard` | 短链接 CRUD 操作 |
| 数据分析 | `/analytics/:id` | 深度点击报告 |
| 域名管理 | `/domains` | 自定义域名配置 |
| API Keys | `/api-keys` | 密钥管理与文档 |
| 授权管理 | `/license` | 套餐订阅管理 |
| 个人设置 | `/profile` | 账户配置 |

---

## 6. 管理后台 (Admin)

> 以下页面需要管理员权限

| 页面 | 路径 | 描述 |
|------|------|------|
| 管理面板 | `/admin` | 系统管理入口 |
| 用户管理 | `/admin` | 用户账户管理 |
| 链接管理 | `/admin` | 全局链接管理 |
| IP 黑名单 | `/admin` | IP 访问控制 |

---

## 7. 跳转引擎 (Redirect Engine)

| 页面 | 路径 | 描述 |
|------|------|------|
| 短链跳转 | `/s/:code` | 核心跳转入口 |
| 安全验证 | `/verify/:token` | 密码/安全验证页 |
| 错误页面 | `/error` | 404/过期等错误提示 |
| 二维码页 | `/qr/:code` | 二维码展示页 |

---

## 8. 开发资源 (Developer Resources)

| 资源 | 链接 |
|------|------|
| GitHub 仓库 | [github.com/hwdemtv/smart-link-manager](https://github.com/hwdemtv/smart-link-manager) |
| 作者主页 | [hwdemtv.com](https://www.hwdemtv.com) |

---

## XML Sitemap

系统自动生成 XML 格式的 sitemap，供搜索引擎抓取：

- **地址**：`/sitemap.xml`
- **更新频率**：每 5 分钟缓存刷新
- **包含内容**：活跃短链接 + 静态页面

---

*© 2026 Smart Link Manager*
