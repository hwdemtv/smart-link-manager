# Smart Link Manager (SLM) 🚀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql)

**Smart Link Manager (智链管理)** 是一款面向企业级应用的现代化 **SaaS 架构** 短链接管理与数据分析平台。它提供极致的跳转性能、深度的数据洞察以及全方位的开放集成能力。

---

## ✨ 核心特性

### 🚀 高性能与可扩展性
- **极致跳转性能**：基于 Node.js 异步非阻塞架构，核心跳转决策仅需 **~2ms**。
- **10万级大数据支撑**：通过服务端分页与搜索重构，首屏加载耗时降低 80%，轻松驾驭海量数据。
- **自定义域名绑定**：支持绑定自有域名，配合 DNS CNAME 验证实现品牌化短链。

### 📊 数据分析与洞察
- **全维度数据分析**：内置 `AnalyticsDashboard`，提供访问走势、地域分布（Treemap）、设备画像及实时点击热力图。
- **A/B 测试分流**：支持为单个短链配置多目标 URL，按比例动态分流，助力营销转化优化。

### 🔍 SEO 与社交治理
- **AI 智能提炼**：一键通过 AI 生成符合 SEO 规范的标题与描述。
- **元数据重定向**：支持自定义 Canonical URL 与状态码 (301/302/307/308)。
- **Open Graph 支持**：自定义社交分享预览图、视频等 OG 标签。

### 🛡️ 安全与合规
- **链接有效性检查**：内置网盘（百度/阿里/夸克）专项探测及通用 URL 巡检，支持一键手动校验。
- **企业级安全架构**：scrypt 密码哈希、JWT 强校验、动态速率限制、系统黑名单。
- **IP 匿名化**：统计链路仅保留城市信息，不持久化存储原始访问 IP。

### 🌐 国际化与用户体验
- **全量国际化 (i18n)**：深度适配中英双语，涵盖界面、反馈及安全二维码验证页面。
- **分组与标签体系**：支持海量链接的分类管理与标签多维过滤。
- **回收站机制**：软删除设计，误删可恢复。

### 💎 SaaS 商业化能力
- **多层级订阅管理**：支持 Free / Pro / Business / Enterprise 四档套餐。
- **API Key 管理**：支持创建多个 API Key，可设置过期时间与使用统计。
- **配额精准控制**：链接数、域名数、API Key 数量按套餐限制。

---

## 🛠️ 技术栈

### 前端 (Frontend)
- **Framework**: [React 19](https://react.dev/) + [Vite 7](https://vitejs.dev/)
- **Styling**: Tailwind CSS 4 + shadcn/ui (赛博美学暗色主题)
- **API 通讯**: [tRPC 11](https://trpc.io/) + [TanStack Query 5](https://tanstack.com/query/latest)
- **状态管理**: TanStack Query (服务端状态) + React Context (客户端状态)
- **表单校验**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **数据可视化**: [Recharts](https://recharts.org/) (图表) + [TanStack Virtual](https://tanstack.com/virtual/latest) (虚拟列表)
- **i18n**: [react-i18next](https://react.i18next.com/)
- **路由**: [Wouter](https://github.com/molefrog/wouter)

### 后端 (Backend)
- **Runtime**: Node.js 18+
- **Framework**: [Express 4](https://expressjs.com/)
- **API 层**: [tRPC 11](https://trpc.io/) (类型安全 RPC) + REST API (开放集成)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Database**: MySQL 8.0 (推荐) / SQLite
- **认证安全**: JWT (jose) + HttpOnly Cookies + scrypt 密码哈希
- **校验**: Zod 严格校验 (前后端共享)
- **地理位置**: [MaxMind GeoIP](https://www.maxmind.com/) (IP 地理解析)
- **任务队列**: [Bull](https://github.com/OptimalBits/bull) (基于 Redis)
- **对象存储**: AWS S3 SDK (可选)

### 开发工具
- **包管理**: pnpm 10+
- **测试**: Vitest + Playwright
- **代码格式化**: Prettier
- **类型检查**: TypeScript 5.7

---

## 📂 项目结构

```text
smart-link-manager/
├── client/                    # 前端 React 应用
│   ├── src/
│   │   ├── _core/             # 系统底座 (tRPC 客户端, i18n, Auth Hooks)
│   │   ├── components/        # UI 组件
│   │   │   ├── admin/         # 管理后台组件 (用户/IP黑名单/链接管理)
│   │   │   ├── dashboard/     # 仪表盘组件 (链接表格/分组侧边栏/分析面板)
│   │   │   └── ui/            # shadcn/ui 基础组件
│   │   ├── hooks/             # 自定义 Hooks (useLinkFilters, useLinkMutations)
│   │   ├── lib/               # 工具函数
│   │   ├── locales/           # 国际化资源 (zh.json / en.json)
│   │   ├── pages/             # 业务页面
│   │   │   ├── Dashboard.tsx  # 主仪表盘
│   │   │   ├── Analytics.tsx  # 数据分析
│   │   │   ├── Domains.tsx    # 域名管理
│   │   │   ├── ApiKeys.tsx    # API Key 管理
│   │   │   ├── LicenseSettings.tsx # 授权管理
│   │   │   └── ...
│   │   └── types/             # TypeScript 类型定义
│   └── index.html             # 入口 HTML
├── server/                    # 后端 API 服务
│   ├── _core/                 # 核心模块
│   │   ├── index.ts           # Express 服务入口
│   │   ├── trpc.ts            # tRPC 路由配置
│   │   ├── context.ts         # 请求上下文与认证
│   │   ├── auth.ts            # 认证工具函数
│   │   └── sdk.ts             # 授权中心 SDK
│   ├── routers/               # tRPC 分模块路由
│   │   ├── links.ts           # 短链接 CRUD + 批量操作
│   │   ├── domains.ts         # 域名验证与管理
│   │   ├── admin.ts           # 管理员操作
│   │   └── user.ts            # 用户配置
│   ├── db.ts                  # 数据库操作层 (Drizzle)
│   ├── restRouter.ts          # REST API v1.1 (OpenAPI)
│   ├── redirectHandler.ts     # 核心跳转引擎 (SSR 元数据)
│   ├── licenseService.ts      # 套餐配额服务
│   ├── aiSeoService.ts        # AI SEO 元数据生成
│   ├── linkChecker.ts         # 链接有效性检测
│   └── geoIpResolver.ts       # IP 地理解析
├── drizzle/                   # 数据库 Schema 与迁移
│   └── schema.ts              # 表结构定义
├── shared/                    # 前后端共享模块
│   ├── errorCodes.ts          # 错误码常量
│   └── validators/            # Zod 校验 Schema
├── docs/                      # 系统文档
│   ├── api.md                 # API 规范
│   ├── security.md            # 安全白皮书
│   └── changelog.md           # 更新日志
├── tests/                     # E2E 测试 (Playwright)
├── DEPLOYMENT.md              # 部署指南
├── CLAUDE.md                  # Claude Code 开发指南
└── package.json
```

---

## 🚀 快速启动

### 环境要求
- Node.js 18+ (推荐 20+)
- pnpm 10+
- MySQL 8.0+ (或 SQLite 用于开发测试)

### 1. 克隆与安装

```bash
git clone https://github.com/your-repo/smart-link-manager.git
cd smart-link-manager
pnpm install
```

### 2. 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# 数据库连接
DATABASE_URL=mysql://用户名:密码@localhost:3306/数据库名

# JWT 密钥 (生产环境必须 32 位以上)
JWT_SECRET=your-super-secret-key-at-least-32-chars

# 应用标识 (用于生成短链接)
VITE_APP_ID=http://localhost:3000

# 可选：默认管理员账号
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your-secure-password
```

### 3. 数据库初始化

```bash
pnpm run db:push
```

### 4. 启动开发服务器

```bash
pnpm run dev
```

访问 `http://localhost:3000` 即可使用。

### 5. 生产构建

```bash
pnpm run build
pnpm run start
```

详细部署方案请参考 [DEPLOYMENT.md](DEPLOYMENT.md)。

---

## 📚 系统文档索引

| 文档 | 描述 |
|------|------|
| [API 规范](docs/api.md) | REST API v1.1 详细接口说明 |
| [部署指南](DEPLOYMENT.md) | 宝塔面板 Docker/Node 部署全流程 |
| [安全说明](docs/security.md) | 企业级安全防护机制白皮书 |
| [更新日志](docs/changelog.md) | 版本迭代历史 |
| [SEO & GEO 优化报告](docs/seo-geo-report.md) | 搜索引擎与 AI 搜索优化成果 |
| [SEO 优化方案](docs/seo-optimization-plan.md) | 搜索引擎优化实施细节 |

### Learning Center (学习中心)

| 文档 | 描述 |
|------|------|
| [什么是短链接？](docs/what-is-url-shortener.md) | 短链接定义与工作原理 |
| [短链接工作原理](docs/how-it-works.md) | 技术实现细节 |
| [短链接的优势](docs/benefits.md) | 业务价值分析 |
| [SEO 最佳实践](docs/best-practices.md) | 搜索引擎优化指南 |
| [API 开发手册](docs/api-guide.md) | 开发者集成指南 |

---

## 🏗️ 开发规范

### 国际化 (i18n)

项目遵循**深度国际化治理规范**，所有新开发的组件必须遵循以下原则：

1. **禁止硬编码**：所有可见文本必须存放在 `client/src/locales/` 下。
2. **命名空间化**：使用 `analytics`, `dashboard`, `admin` 等命名空间。
3. **动态调用**：通过 `useTranslation` Hook 的 `t()` 函数进行引用。

```tsx
// ✅ 正确示例
const { t } = useTranslation('dashboard');
return <span>{t('links.createSuccess')}</span>;

// ❌ 错误示例
return <span>创建成功</span>;
```

### tRPC 路由规范

```tsx
// 使用 protectedProcedure 需要用户登录
protectedProcedure.input(createLinkSchema).mutation(async ({ ctx, input }) => {
  // ctx.user 自动注入当前用户信息
});

// 使用 publicProcedure 无需认证
publicProcedure.query(async () => {
  return { status: 'ok' };
});
```

### 数据库操作

所有数据库操作集中在 `server/db.ts`，使用 Drizzle ORM：

```ts
// 查询示例
const links = await db.select().from(linksTable).where(eq(linksTable.userId, userId));

// 插入示例
await db.insert(linksTable).values(newLink);
```

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 🗄️ 数据模型

系统核心数据表结构如下：

| 表名 | 描述 |
|------|------|
| `users` | 用户信息与订阅状态 |
| `links` | 短链接主表 (含 SEO、A/B 测试、软删除等) |
| `domains` | 自定义域名与验证状态 |
| `link_groups` | 链接分组 |
| `link_stats` | 点击统计 (设备、地域、来源等) |
| `link_checks` | 链接有效性检查记录 |
| `api_keys` | API Key 管理 |
| `notifications` | 系统通知 |
| `audit_logs` | 操作审计日志 |
| `ip_blacklist` | IP 黑名单 |

详细的 Schema 定义请参考 `drizzle/schema.ts`。

---

## 🔌 API 快速参考

### REST API (开放集成)

```bash
# 认证
curl -H "Authorization: Bearer YOUR_API_KEY" https://your-domain/api/v1/links

# 创建短链接
curl -X POST https://your-domain/api/v1/links \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "https://example.com", "shortCode": "mycode"}'
```

### tRPC API (内部使用)

```ts
// 前端调用示例
const { data } = trpc.links.list.useQuery({ page: 1, limit: 20 });
const mutation = trpc.links.create.useMutation();
await mutation.mutateAsync({ originalUrl: 'https://example.com' });
```

完整 API 文档请参考 [docs/api.md](docs/api.md)。

---

## 🧪 测试

```bash
# 运行单元测试
pnpm run test

# 运行 E2E 测试
npx playwright test
```

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

请确保：
- 代码通过 TypeScript 类型检查 (`pnpm run check`)
- 新增功能有对应的测试用例
- 遵循现有的代码风格和国际化规范

---

## 📞 支持

- **问题反馈**: [GitHub Issues](https://github.com/your-repo/smart-link-manager/issues)
- **功能建议**: [GitHub Discussions](https://github.com/your-repo/smart-link-manager/discussions)
