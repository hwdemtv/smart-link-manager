# Smart Link Manager (SLM) 🚀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Typescript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)

**Smart Link Manager** 是一款面向企业级应用的现代化 **SaaS 架构** 短链接管理与数据分析平台。它不仅提供基础的链接缩短功能，还深度集成了多租户管理、自定义域名托管、实时点击统计以及移动端友好的二维码服务。

---

## ✨ 核心特性

- **🚀 极致的全栈性能**：采用 Vite + React 19 核心并发渲染；配合 Gzip 路由传输协议压缩、第三方依赖分包 (Vendor Splitting) 与网络预连接，实现关键打包体积不足 220KB，首屏骨架秒出！
- **🌍 全量国际化 (i18n)**：深度适配中英双语，支持界面文本、交互反馈、甚至二维码页面的实时切换。
- **🛡️ 现代化 SaaS 设计**：
  - **多维度租户隔离**：内置超级管理员面板 (Admin Dashboard) 管控全站系统逻辑。
  - **深度的操作审计**：集成原生审计日志（Audit Logs）体系与多租户隔离，追踪敏感角色数据的更改与流转。
  - **海量批量运营支持**：实现全站用户的快速 CSV 报表提取、多选过期日期管理与违规连带删除机制。
- **🔗 域名托管系统**：支持 CNAME、TXT 及文件上传三种校验方式，允许用户使用自有域名（如 `s.mybrand.com`），并支持超管按域追溯筛选。
- **📊 深度分析与监控**：
  - 实时记录点击次数、设备类型（手机/桌面/平板）。
  - 内置链接生命周期管理（具备完善的验证预警），超管可在 Quick Stats 中心获取实时的增长与过期异动趋势。
- **📱 QR Code 增强**：每个链接自动生成专属扫码页，支持二维码本地下载。
- **🪄 生产级 UI/UX**：基于 shadcn/ui 打造，集成现代磨砂玻璃效果、平滑动画、无需 JS 热加载的 CSS 响应骨架框体系。

---

## 🛠️ 技术栈

### 前端 (Frontend)
- **Framework**: [React 19](https://react.dev/) (选用最新并发特性)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State & API**: [tRPC](https://trpc.io/) + [TanStack Query](https://tanstack.com/query/latest)
- **i18n**: [react-i18next](https://react.i18next.com/)

### 后端 (Backend)
- **Runtime**: [Node.js](https://nodejs.org/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (类型安全、轻量级)
- **Database**: MySQL (支持分布式架构)
- **Authentication**: JWT (JSON Web Tokens) with Secure HttpOnly Cookies
- **Communication**: tRPC (实现前后端全量类型同步)

---

## 📂 项目结构

```text
├── client/                 # 前端 React 应用
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
