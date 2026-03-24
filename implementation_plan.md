# Smart Link Manager - 实施计划

## 背景概述

项目已从 V1（基于租户的多租户架构）迁移至 V2（基于用户与授权卡密的架构）。代码审查发现仍存在残留的 V1 术语、硬编码配置和可优化的代码模式。

---

## 1. 术语对齐 (Terminology Alignment) ✅

### 问题

- i18n 文件中残留 `tenant` 相关命名空间和词条
- 管理组件中存在 `tenantMgmt` 命名空间引用
- 部分错误码使用 `FORBIDDEN_NO_TENANT`

### 影响文件

| 文件                                | 问题                           |
| ----------------------------------- | ------------------------------ |
| `client/src/locales/zh.json`        | `admin.tenantMgmt.*` 命名空间  |
| `client/src/locales/en.json`        | `admin.tenantMgmt.*` 命名空间  |
| `shared/errorCodes.ts`              | `FORBIDDEN_NO_TENANT` 错误码   |
| `client/src/components/admin/*.tsx` | 引用 `t("admin.tenantMgmt.*")` |

### 解决方案

1. 重命名 i18n 命名空间 `tenantMgmt` → `admin`
2. 移除无用的租户相关词条
3. 更新错误码 `FORBIDDEN_NO_TENANT` → 移除或改为通用权限错误

### 已完成 (2026-03-22)

- 移除 `admin.tenantMgmt` 命名空间，将分页移至 `admin.pagination`
- 移除 `admin.tenantRegister` 命名空间
- 更新 `admin.usage`: `topTenants` → `topUsers`
- 更新 `admin.subMgmt`: 移除 tenant 相关字段
- 更新 `admin.userMgmt`: 移除 tenant 相关字段
- 更新 `admin.auditLog`: 移除 tenant 相关字段
- 更新 `admin.linkMgmt`: 移除 tenant 字段
- 更新 `login.noTenant` → `login.noAccount`
- 更新错误码 `FORBIDDEN_NO_TENANT` → `FORBIDDEN_NO_USER`
- 更新组件引用至新的 locale 路径

---

## 2. 安全加固 (Security Hardening) ✅

### 问题

- `LICENSE_SERVER_URL` 使用硬编码默认值 `'https://license.example.com'`
- 敏感配置应完全依赖环境变量

### 解决方案

已通过 `server/_core/env.ts` 和 `server/licenseService.ts` 实现：

- `licenseServerUrl` 默认为空字符串（无硬编码 URL）
- 生产环境强制要求环境变量，否则抛出错误
- 开发环境允许空值，便于本地调试

### 已完成 (2026-03-22)

- 确认无硬编码默认 URL
- 生产环境强制校验 `LICENSE_SERVER_URL`

---

## 3. 性能优化 (Performance Optimization) ✅

### 问题

- 高频统计更新使用 `SELECT` + `UPDATE` 两步操作
- 存在竞态条件风险

### 验证结果

已确认使用原子更新，无竞态条件：

| 函数                   | 文件               | 实现                                             |
| ---------------------- | ------------------ | ------------------------------------------------ |
| `updateLinkClickCount` | `server/db.ts:405` | ✅ `sql\`clickCount + 1\`` 原子递增              |
| `recordUsage`          | `server/db.ts:596` | ✅ `INSERT ... ON DUPLICATE KEY UPDATE` 原子操作 |

### 已完成 (2026-03-22)

- 验证 `updateLinkClickCount` 使用 SQL 原子递增
- 验证 `recordUsage` 使用 MySQL 原子 upsert

---

## 4. 代码重构 (Code Refactoring)

### 问题

- `Dashboard.tsx` 文件过大（~1200 行）
- 混合了列表、创建、编辑、批量操作等多种逻辑

### 建议拆分

```
client/src/pages/Dashboard/
├── index.tsx           # 主页面组件
├── LinkTable.tsx       # 链接列表表格
├── LinkFormDialog.tsx  # 创建/编辑表单弹窗
├── BatchActions.tsx    # 批量操作工具栏
├── ImportExport.tsx    # 导入导出功能
└── hooks/
    ├── useLinkMutations.ts  # 链接 CRUD mutations
    └── useLinkFilters.ts    # 筛选逻辑
```

### 优先级

- P2 - 可在后续迭代中逐步拆分

---

## 5. 数据库清理 (Database Cleanup) ✅

### 问题

- 数据库迁移文件中残留 `tenant` 相关字段
- 部分快照文件包含过时结构

### 审查结果

- `drizzle/0005_dashing_thunderbird.sql` - 正确删除了所有 tenant 相关表和字段
- 已删除的表：`tenants`, `tenant_configs`, `subscriptions`, `subscription_plans`, `subscription_change_requests`
- 已删除的字段：各表中的 `tenantId` 字段
- 新增字段：`users.subscriptionTier`, `users.licenseKey`, `users.licenseExpiresAt`, `users.licenseToken`

### 已完成 (2026-03-22)

- 审查迁移文件，确认 `tenantId` 字段已从所有表移除
- 创建 `0006_snapshot.json` 更新快照
- 确认数据库架构与 V2 架构一致

---

## 实施优先级

| 优先级 | 任务                          | 预估工作量 | 状态      |
| ------ | ----------------------------- | ---------- | --------- |
| P0     | 安全加固 - LICENSE_SERVER_URL | 5 分钟     | ✅ 已完成 |
| P1     | 术语对齐 - i18n 文件          | 30 分钟    | ✅ 已完成 |
| P1     | 术语对齐 - 组件更新           | 20 分钟    | ✅ 已完成 |
| P2     | 性能优化 - 验证原子更新       | 10 分钟    | ✅ 已完成 |
| P2     | 代码重构 - Dashboard 拆分     | 2-3 小时   | ✅ 已完成 |
| P3     | 数据库清理 - 迁移文件审查     | 30 分钟    | ✅ 已完成 |

---

## 变更日志

| 日期       | 变更                                                                |
| ---------- | ------------------------------------------------------------------- |
| 2026-03-22 | 初始版本                                                            |
| 2026-03-22 | 完成术语对齐 - 移除所有 tenant 相关引用                             |
| 2026-03-22 | 确认安全加固完成 - LICENSE_SERVER_URL 无硬编码，生产环境强制要求    |
| 2026-03-22 | 验证性能优化 - updateLinkClickCount 和 recordUsage 均使用原子更新   |
| 2026-03-22 | 完成 Dashboard 拆分重构 - 主文件从 1279 行减至 ~350 行              |
| 2026-03-22 | 完成数据库清理 - 审查迁移文件，确认 tenant 字段已清理，更新快照文件 |
