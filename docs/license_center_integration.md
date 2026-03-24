# 授权中心 (hw-license-center) 对接文档

## 概述

Smart Link Manager (SLM) 已从多租户结构全面重构为 **多用户 + 卡密独立授权** 架构。所有的高级能力（配额提升、绑定）均依赖于外部的授权验证中心：`hw-license-center`。

本文档详细介绍了 SLM 如何与该授权中心进行集成。

## 一、环境变量配置

在根目录的 `.env` 文件中配置以下参数以对接授权服务：

```env
# 授权中心 API 的基础地址（多个地址以逗号分隔，系统将优先尝试此地址链）
LICENSE_SERVER_URLS=https://license.YOUR_DOMAIN.com
LICENSE_SERVER_URL=https://license.YOUR_DOMAIN.com
```

_(注：代码中首选 `LICENSE_SERVER_URL`，如果存在多个 URL 地址需要前端或后端做多路回退封装可以依赖 `LICENSE_SERVER_URLS`)_

## 二、产品映射 (Product Identifiers)

授权中心可能颁发多种卡密，SLM 只关注自己的核心产品 ID 映射。
在 `server/licenseService.ts` 中维护以下强映射：

| 授权中心 Product ID   | SLM 内部等级 (Tier) | 权限配额控制                             |
| :-------------------- | :------------------ | :--------------------------------------- |
| `smart-link-pro`      | `pro`               | Links: 500, Domains: 5, API Keys: 5      |
| `smart-link-business` | `business`          | Links: 无限制, Domains: 10, API Keys: 10 |
| (未绑定或过期)        | `free`              | Links: 20, Domains: 1, API Keys: 1       |

> **提示**：如果同一个卡密包含了两个产品授权，SLM 的解析策略为**优先降级为高级别**（即先检测 `BUSINESS`，再检测 `PRO`）。

## 三、核心对接 API

与 `hw-license-center` 的所有 HTTP 交互都封装在向该服务器的调用中，具体实现位于 `server/licenseService.ts`。

### 1. 验证激活卡密 (Verify & Activate)

**Endpoint**: `POST /api/v1/auth/verify`

用于校验用户提交的卡密，并将 `deviceId` (在 SLM 中我们使用用户的内部 `id` 作为唯一的 deviceId) 和设备名称传入进行绑定。

**Request Payload:**

```json
{
  "license_key": "YOUR_INPUT_LICENSE_KEY",
  "device_id": "1", // string: SLM 中的 User ID
  "device_name": "User 1" // string: SLM 中的用户名或 Name
}
```

**Response 解析处理:**
成功时，接口返回含有 `products` 数组的数据。
服务端会自动搜索状态为 `status: 'active'` 的匹配 `smart-link-*` 的产品定义。解析出 `expiresAt`（过期时间）以及下发认证令牌 `token`。随后服务端负责更新本库 `users` 表结构。

### 2. 解绑卡密 (Unbind License)

**Endpoint**: `POST /api/v1/auth/unbind`

用户主动解除设备的当前绑定，降级至 `free` 版。

**Request Payload:**

```json
{
  "license_key": "CURRENTLY_BOUND_LICENSE_KEY",
  "device_id": "1" // 必须与 Verify 时的 ID 一致
}
```

## 四、数据持久化策略

SLM 后端会将通过与授权中心验证后的数据快照同步写入至自身的数据库 `users` 表格中，以加速本地权限感知。

- **`subscriptionTier`**: 当前计算后的等级 `free`, `pro`, `business`。
- **`licenseKey`**: 用户成功绑定的脱敏或完整卡密编码。
- **`licenseExpiresAt`**: 卡密有效截止的系统时间 (`null` 则指永久有效)。
- **`licenseToken`**: 由授权中心下发的令牌用于日后快速鉴定通信。

## 五、鉴权逻辑 (Quota Checks)

所有的配额查询与管理路由 (如 `server/userRouter.ts -> getSubscription`) 会自动计算：

1. 是否已存在授权。
2. 调用 `licenseService.isSubscriptionValid(expiresAt)` 判定时间是否超期。
3. 如果超期，其 Tier 被系统强制降级为 `free` 提供只读保障能力，不再阻断日常数据存取但会限制新资源（如 Link）的生成操作。
