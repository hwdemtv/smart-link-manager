# Smart Link Manager - 实施计划

## 背景概述

项目已从 V1（基于租户的多租户架构）迁移至 V2（基于用户与授权卡密的架构）。代码审查发现仍存在残留的 V1 术语、硬编码配置和可优化的代码模式。

---

## 1. 术语对齐 (Terminology Alignment)

### 问题
- i18n 文件中残留 `tenant` 相关命名空间和词条
- 管理组件中存在 `tenantMgmt` 命名空间引用
- 部分错误码使用 `FORBIDDEN_NO_TENANT`

### 影响文件
| 文件 | 问题 |
|------|------|
| `client/src/locales/zh.json` | `admin.tenantMgmt.*` 命名空间 |
| `client/src/locales/en.json` | `admin.tenantMgmt.*` 命名空间 |
| `shared/errorCodes.ts` | `FORBIDDEN_NO_TENANT` 错误码 |
| `client/src/components/admin/*.tsx` | 引用 `t("admin.tenantMgmt.*")` |

### 解决方案
1. 重命名 i18n 命名空间 `tenantMgmt` → `admin`
2. 移除无用的租户相关词条
3. 更新错误码 `FORBIDDEN_NO_TENANT` → 移除或改为通用权限错误

---

## 2. 安全加固 (Security Hardening)

### 问题
- `LICENSE_SERVER_URL` 使用硬编码默认值 `'https://license.example.com'`
- 敏感配置应完全依赖环境变量

### 影响文件
| 文件 | 问题 |
|------|------|
| `server/licenseService.ts` | 硬编码默认 License Server URL |

### 解决方案
```typescript
// Before
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://license.example.com';

// After
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL;
if (!LICENSE_SERVER_URL) {
  throw new Error('LICENSE_SERVER_URL environment variable is required');
}
```

---

## 3. 性能优化 (Performance Optimization)

### 问题
- 高频统计更新使用 `SELECT` + `UPDATE` 两步操作
- 存在竞态条件风险

### 影响位置
| 函数 | 文件 | 问题 |
|------|------|------|
| `updateLinkClickCount` | `server/db.ts` | 非原子更新 |
| `recordUsage` | `server/db.ts` | 先查后写模式 |

### 解决方案
使用 Drizzle 原子更新：
```typescript
// Before
await db.update(links).set({ clickCount: sql`clickCount + 1` }).where(eq(links.id, linkId));

// Already using atomic update - verify implementation
```

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

## 5. 数据库清理 (Database Cleanup)

### 问题
- 数据库迁移文件中残留 `tenant` 相关字段
- 部分快照文件包含过时结构

### 影响文件
- `drizzle/0005_dashing_thunderbird.sql`
- `drizzle/meta/*.json`

### 解决方案
- 审查迁移文件，确认 `tenantId` 字段已从 `users` 表移除
- 更新文档说明当前架构

---

## 实施优先级

| 优先级 | 任务 | 预估工作量 |
|--------|------|------------|
| P0 | 安全加固 - LICENSE_SERVER_URL | 5 分钟 |
| P1 | 术语对齐 - i18n 文件 | 30 分钟 |
| P1 | 术语对齐 - 组件更新 | 20 分钟 |
| P2 | 性能优化 - 验证原子更新 | 10 分钟 |
| P2 | 代码重构 - Dashboard 拆分 | 2-3 小时 |
| P3 | 数据库清理 - 迁移文件审查 | 30 分钟 |

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-03-22 | 初始版本 |
