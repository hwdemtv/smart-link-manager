# Smart Link Manager 安全白皮书

本文档详细说明 Smart Link Manager 的安全架构、防护机制及最佳实践建议。

## 目录

- [安全架构概览](#安全架构概览)
- [身份认证与访问控制](#身份认证与访问控制)
- [数据安全](#数据安全)
- [网络安全](#网络安全)
- [应用安全](#应用安全)
- [审计与监控](#审计与监控)
- [合规性](#合规性)
- [安全最佳实践](#安全最佳实践)
- [漏洞报告](#漏洞报告)

---

## 安全架构概览

Smart Link Manager 采用**纵深防御**策略，在多个层面实施安全控制：

```
┌─────────────────────────────────────────────────────────┐
│                      用户层                              │
│  浏览器 / API Client / 移动端                            │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    传输层 (TLS)                          │
│  HTTPS 加密传输                                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    应用层                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ 速率限制    │ │ 输入验证    │ │ 认证授权    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ XSS 防护    │ │ CSRF 防护   │ │ SQL 注入防护 │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    数据层                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ 密码哈希    │ │ 敏感数据加密 │ │ 访问控制    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## 身份认证与访问控制

### 1. 密码安全

#### scrypt 哈希算法

所有用户密码均使用 **scrypt** 算法进行加盐哈希存储：

```typescript
// 密码哈希配置
const hashConfig = {
  N: 16384,      // CPU/memory 成本因子
  r: 8,          // 块大小
  p: 1,          // 并行化因子
  keylen: 64,    // 输出密钥长度
  saltLength: 32 // 盐值长度
};
```

**特性**：
- 内存硬度设计，抵抗 GPU/ASIC 破解
- 每个密码使用独立随机盐值
- 防止彩虹表攻击

#### 密码策略

| 要求 | 说明 |
|------|------|
| 最小长度 | 8 位 (推荐 12 位以上) |
| 生产环境 | 强制要求设置管理员密码 |
| 开发环境 | 自动生成随机密码并输出到日志 |

### 2. JWT 认证

#### Token 结构

```
Header.Payload.Signature
```

**安全配置**：
- **算法**: HS256
- **密钥长度**: 强制 32 位以上
- **存储方式**: HttpOnly Cookie (防 XSS)
- **传输**: 仅 HTTPS

#### 会话管理

```typescript
// Cookie 安全配置
{
  httpOnly: true,      // 禁止 JavaScript 访问
  secure: true,        // 仅 HTTPS 传输
  sameSite: 'lax',     // CSRF 防护
  maxAge: 7 * 24 * 3600 * 1000, // 7 天有效期
  path: '/',
}
```

### 3. 访问控制

#### 角色权限

| 角色 | 权限范围 |
|------|---------|
| `user` | 管理自己的链接、域名、API Key |
| `admin` | 全量用户管理、系统配置、IP 黑名单 |

#### tRPC 过程类型

```typescript
// 公开接口 - 无需认证
publicProcedure.query(...)

// 受保护接口 - 需要登录
protectedProcedure.mutation(...)

// 管理员接口 - 需要 admin 角色
adminProcedure.mutation(...)
```

---

## 数据安全

### 1. 敏感数据处理

#### IP 地址匿名化

点击统计时对访问者 IP 进行掩码处理：

```typescript
// 仅保留地理位置信息，不存储原始 IP
const anonymizedData = {
  country: geoData.country,
  city: geoData.city,
  // ipAddress 不持久化存储
};
```

#### API Key 存储

API Key 采用哈希存储，原始密钥仅在创建时显示一次：

```typescript
// 存储格式
{
  prefix: 'slm_live',     // 前缀 (可显示)
  keyHash: 'sha256...',   // 完整密钥的哈希值
  // 原始密钥不存储
}
```

### 2. 数据库安全

#### 连接安全

- 使用连接池管理数据库连接
- 支持 SSL 加密连接
- 最小权限原则：应用账户仅拥有必要的 CRUD 权限

#### SQL 注入防护

使用 Drizzle ORM 参数化查询：

```typescript
// ✅ 安全：参数化查询
await db.select().from(links).where(eq(links.userId, userId));

// ❌ 危险：字符串拼接 (不使用)
await db.execute(`SELECT * FROM links WHERE userId = ${userId}`);
```

### 3. 数据备份

**建议备份策略**：
- 每日全量备份
- 保留 7 天备份
- 异地备份存储

---

## 网络安全

### 1. TLS/SSL

**生产环境强制要求 HTTPS**：
- TLS 1.2+ 协议
- 强加密套件
- HSTS 头启用

```nginx
# Nginx SSL 配置示例
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
add_header Strict-Transport-Security "max-age=63072000" always;
```

### 2. CORS 策略

```typescript
// CORS 配置
{
  origin: process.env.CORS_ORIGINS?.split(',') || [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}
```

### 3. 安全响应头

```typescript
// 全局安全头
{
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; ..."
}
```

---

## 应用安全

### 1. 速率限制

#### 跳转限速

- **限制**: 每 IP 每 60 秒 100 次跳转
- **目的**: 防止恶意刷点击、DDoS 攻击
- **实现**: 内存滑动窗口算法

#### REST API 限速

- **限制**: 每 IP 每 60 秒 60 次请求
- **响应**: 超限返回 429 状态码

```json
{
  "error": "Too Many Requests",
  "message": "API rate limit exceeded. Please slow down."
}
```

### 2. 输入验证

#### Zod Schema 验证

所有输入数据经过严格验证：

```typescript
const createLinkSchema = z.object({
  shortCode: z.string()
    .min(3, "短码至少3个字符")
    .max(20, "短码最多20个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "短码只能包含字母、数字、下划线和横线"),
  originalUrl: z.string().url("请输入有效的 URL"),
});
```

#### XSS 防护

- React 自动转义输出
- CSP 头限制脚本来源
- 输入内容白名单过滤

### 3. 爬虫防护

#### 内置黑名单

预置 **10,000+** 恶意爬虫与扫描器指纹：

```typescript
const BLOCKED_USER_AGENTS = [
  /sqlmap/i,
  /nmap/i,
  /nikto/i,
  /masscan/i,
  // ... 更多
];
```

#### Bot 检测

- 移动端访问直接跳转
- PC 端展示安全验证页面
- 搜索引擎蜘蛛识别并提供 SEO 元数据

---

## 审计与监控

### 1. 操作审计

**审计日志记录范围**：

| 操作类型 | 记录内容 |
|----------|----------|
| 用户认证 | 登录、登出、注册 |
| 链接管理 | 创建、更新、删除 |
| 域名管理 | 添加、验证、删除 |
| 系统配置 | 黑名单、用户状态变更 |

**审计日志结构**：

```typescript
interface AuditLog {
  id: number;
  userId: number;
  action: string;        // 'link.create', 'user.login', etc.
  targetType: string;    // 'link', 'user', 'domain'
  targetId: number;
  details: object;       // 操作详情
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

### 2. 错误监控

- 结构化日志记录
- 错误堆栈追踪
- 敏感信息脱敏

### 3. 性能监控

- 请求响应时间
- 数据库查询性能
- 缓存命中率

---

## 合规性

### GDPR 合规

| 要求 | 实现状态 |
|------|---------|
| 数据最小化 | ✅ 仅收集必要数据 |
| 数据匿名化 | ✅ IP 地址掩码处理 |
| 用户数据导出 | ✅ 支持链接数据导出 |
| 用户数据删除 | ✅ 支持账户注销 |

### 数据保留

| 数据类型 | 保留期限 |
|----------|----------|
| 用户账户 | 账户存续期间 |
| 链接数据 | 用户删除为止 |
| 点击统计 | 链接删除为止 |
| 审计日志 | 90 天 |

---

## 安全最佳实践

### 部署安全检查清单

- [ ] JWT_SECRET 设置为 32 位以上随机字符串
- [ ] 生产环境强制 HTTPS
- [ ] 数据库使用强密码
- [ ] Redis 设置密码
- [ ] 配置防火墙规则
- [ ] 定期更新依赖包
- [ ] 启用日志监控

### 日常运维建议

1. **定期更新依赖**
   ```bash
   pnpm update
   pnpm audit
   ```

2. **监控异常登录**
   - 关注异地登录告警
   - 审查管理员操作日志

3. **备份验证**
   - 定期测试备份恢复流程
   - 验证备份数据完整性

4. **安全扫描**
   - 定期进行漏洞扫描
   - 关注安全公告

---

## 漏洞报告

如果您发现安全漏洞，请负责任地披露：

### 报告方式

- **邮箱**: security@smartlinkmanager.com
- **PGP 公钥**: [下载](/.well-known/pgp-key.txt)

### 报告内容

请包含以下信息：
- 漏洞描述
- 复现步骤
- 影响范围
- 可能的修复建议

### 响应承诺

| 阶段 | 时间 |
|------|------|
| 确认收到 | 24 小时内 |
| 初步评估 | 3 个工作日 |
| 修复计划 | 7 个工作日 |
| 安全公告 | 修复发布后 |

---

## 安全更新历史

| 日期 | 更新内容 |
|------|----------|
| 2026-03-25 | 新增 IP 黑名单内存熔断机制 |
| 2026-03-20 | 升级 scrypt 参数配置 |
| 2026-03-15 | 新增审计日志功能 |
| 2026-03-01 | 初版安全白皮书发布 |

---

*© 2026 Smart Link Manager 安全团队*
