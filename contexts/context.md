# 项目上下文 - Smart Link Manager (SLM)

## 项目基础

- **目标**: 企业级现代化 SaaS 短链接管理与数据分析平台。
- **架构演变**:
  - **V1 (初始)**: 多租户 (Tenant) 架构，支持子账号和订阅方案。
  - **V2 (当前 - 2026-03-16)**: **多用户 + 卡密授权 (License)** 架构。移除了租户概念，改为基于用户的订阅层级和卡密激活。

## 核心业务逻辑 (V2)

### 1. 授权模型

- 每个用户拥有独立的 `subscriptionTier`（订阅等级）。
- 用户通过 `licenseKey` 激活不同的等级。
- 授权验证对接外部服务 `hw-license-center`。
- 关键字段（`users` 表）:
  - `subscriptionTier`: 用户当前等级 (如 FREE, PRO, ENTERPRISE)。
  - `licenseKey`: 最近一次使用的卡密。
  - `licenseExpiresAt`: 授权到期时间。
  - `licenseToken`: 验证令牌。

### 2. 配额限制

- 系统根据 `subscriptionTier` 限制用户可创建的链接数量、自定义域名数量等。

### 3. 数据隔离

- 所有业务实体（Links, Domains, Notifications 等）统一通过 `userId` 进行索引和归属。

## 技术栈

- **前端**: React 19, Vite, Tailwind CSS, shadcn/ui.
- **后端**: Node.js, tRPC, Drizzle ORM.
- **数据库**: MySQL.
- **验证中心**: `LICENSE_SERVER_URL` 配置的外部服务。

## 关键文件

- `server/licenseService.ts`: 处理与授权中心的交互。
- `server/userRouter.ts`: 用户管理和授权相关的 API。
- `client/src/pages/LicenseSettings.tsx`: 前端授权管理界面。
