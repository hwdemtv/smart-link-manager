# Smart Link Manager (SLM) 🚀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.1.0-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Typescript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

**Smart Link Manager** 是一款面向企业级应用的现代化 **SaaS 架构** 短链接管理与数据分析平台。它不仅提供极致的链接缩短体验，还深度集成了 A/B 测试、深度 SEO 治理、多租户管理及亚秒级跳转响应。

---

## ✨ 核心特性

- **🚀 极致跳转性能**：基于 Node.js 异步非阻塞架构，跳转决策仅需 ~2ms。
- **⚖️ 智能 A/B 测试**：支持为单个短链配置多个目标 URL，并按设定的权重比例动态分流。
- **🔍 深度 SEO 治理**：
  - 精准识别主流搜索引擎爬虫。
  - 自动生成 JSON-LD、OpenGraph 与 Twitter Card 元数据。
  - 支持自定义 Canonical URL 与重定向状态码（301/302/307/308）。
- **🌍 全量国际化 (i18n)**：深度适配中英双语，涵盖界面、反馈及 SSR 二维码页面。
- **🛡️ 企业级安全性**：
  - **链路保护**：支持密码保护链接，前端无感验证。
  - **输入校验**：全量集成 Zod 严格校验，杜绝 SQL 注入与 XSS。
  - **防洪限流**：内置内存 Map 硬上限与 Redis 级速率限制。
  - **可靠性**：数据库高频写入任务（统计、日志）具备 3 次异步重试机制。
- **📊 全维度分析与合规**：
  - 点击量、GeoIP（国家/城市）、终端设备、操作系统、来源（Referrer）实时统计。
  - **隐私脱敏**：日志中敏感 IP 自动掩码，UA 自动截断，符合现代 GDPR 合规趋势。
- **🪄 赛博美学 UI**：基于 shadcn/ui 的暗色“赛博机甲”风格，集成毛玻璃拟态与环境光。

---

## 🛠️ 技术栈

### 前端 (Frontend)
- **Framework**: [React 19](https://react.dev/) (选用最新并发特性)
- **Build Tool**: [Vite 7](https://vitejs.dev/)
- **Styling**: Tailwind CSS + shadcn/ui
- **State & API**: [tRPC](https://trpc.io/) + [TanStack Query](https://tanstack.com/query/latest)
- **i18n**: [react-i18next](https://react.i18next.com/)
- **Performance**: `@tanstack/react-virtual` 支撑万级数据顺滑渲染

### 后端 (Backend)
- **Runtime**: Node.js 18+
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (类型安全、极速透明)
- **Database**: MySQL 8.0 / SQLite
- **Security**: JWT + HttpOnly Cookies, Argon2 密码哈希, AbortSignal 超时控制
- **Validation**: Zod 1.0 (全量覆盖)

---

## 📂 项目结构

```text
├── client/                 # 前端 React 应用
│   ├── src/
│   │   ├── _core/          # 系统底座 (tRPC context, i18n config)
│   │   ├── components/     # 原子化 UI 组件
│   │   ├── locales/        # 国际化资源 (zh.json/en.json)
│   │   ├── pages/          # 业务逻辑页面 (Home, Dashboard, DocPage)
│   │   └── lib/            # 工具类 (clipboard, analytics)
├── server/                 # 后端 API 服务
│   ├── routers/            # 分模块 tRPC 路由 (Admin, Link, Auth)
│   ├── db.ts               # 数据持久化层 (带 Retry 逻辑)
│   ├── redirectHandler.ts  # 核心跳转控制引擎 (SSR)
│   └── licenseService.ts   # SaaS 订阅配额校验
├── drizzle/                # 数据库核心 Schema 与迁移定义
└── docs/                   # 详尽的系统文档
```

---

## 🚀 快速启动

### 1. 安装与初始化
```bash
pnpm install
# 执行数据库物理层初始化
pnpm run db:push
```

### 2. 启动开发模式
```bash
pnpm run dev
```
访问地址: `http://localhost:3000`

---

## 📚 系统文档索引

- [🌐 部署指南](DEPLOYMENT.md) - 获取生产环境最佳实践。
- [🔑 API 规范](docs/api.md) - 了解 REST 与 tRPC 调用接口。
- [🛡️ 安全说明](docs/security.md) - SLM 安全防护机制白皮书。
- [📜 更新日志](docs/changelog.md) - 追踪版本迭代历史。

---

## 🤝 联系与支持

您可以点击首页底部的**在线咨询**或参考 [联系方式](docs/contact.md) 获取技术支持：

- **WeChat**: YourWeChatID (备注：企业咨询)
- **Email**: sales@hubinwei.top
- **GitHub**: [hwdemtv/smart-link-manager](https://github.com/hwdemtv/smart-link-manager)

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。
│   ├── src/
│   │   ├── _core/          # 核心 Hooks 与工具
│   │   ├── components/     # 公共 UI 组件与布局 (DashboardLayout)
│   │   ├── locales/        # i18n 多语言资源 (zh.json/en.json)
│   │   ├── pages/          # 业务页面 (Dashboard, Domains, QRPage...)
│   │   └── lib/            # tRPC 客户端配置
├── server/                 # 后端 API 服务
│   ├── db.ts               # Drizzle 数据库逻辑与事务
│   ├── routers.ts          # tRPC 路由定义 (Auth, Links, Domains...)
│   └── redirectHandler.ts  # 短链接解析与跳转逻辑
└── drizzle/                # 数据库 Schema 与迁移定义
```

---

## 🚀 快速启动

### 1. 环境准备

确保您的环境中已安装 **Node.js 18+** 和 **MySQL**。

### 2. 安装依赖

```bash
npm install
# 或者
pnpm install

# 数据库迁移
pnpm run db:push

# 启动开发服务器
pnpm run dev
```

访问地址: `http://localhost:3000`

## 🏗️ 国际化开发规范

项目遵循**深度国际化治理规范**，所有新开发的组件必须遵循以下原则：

1. **禁止硬编码**：所有可见文本必须存放在 `client/src/locales/` 下的 JSON 文件中。
2. **命名空间化**：
   - `common`: 通用词条。
   - `dashboard`: 用户仪表盘。
   - `admin`: 管理员面板（含 `usage`, `tenantMgmt`, `subMgmt` 等子命名空间）。
3. **动态调用**：使用 `useTranslation` Hook 的 `t()` 函数进行引用。

## 🐳 Docker 部署

```bash
docker-compose up -d
```

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。
