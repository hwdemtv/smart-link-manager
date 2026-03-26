# Smart Link Manager API 集成指南

## 简介

Smart Link Manager 提供了一套功能强大的 REST API，允许开发者在 5 分钟内将短链接生成能力集成到自己的系统中。

## API Base URL

| 环境 | 地址 |
|------|------|
| 开发环境 | `http://localhost:3000/api/v1` |
| 生产环境 | `https://your-domain.com/api/v1` |

## 认证方式

所有 API 请求需要在 Header 中携带 API Key：

```http
Authorization: Bearer YOUR_API_KEY
```

获取 API Key：登录管理后台 -> 设置 -> API Keys -> 创建新密钥

---

## 快速示例：使用 Node.js 创建短链接

```javascript
const axios = require('axios');

// 替换为您的实际域名
const API_BASE = 'https://your-domain.com/api/v1';
const API_KEY = 'slm_live_your_api_key_here';

async function createLink() {
  try {
    const response = await axios.post(`${API_BASE}/links`, {
      originalUrl: 'https://your-long-url.com/something-very-long',
      shortCode: 'my-custom-path', // 可选，不填则自动生成
      description: '营销活动链接',  // 可选
      tags: ['营销', '活动'],        // 可选
      redirectType: '302'           // 可选: 301/302/307/308
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('短链接已创建:', response.data);
  } catch (error) {
    console.error('创建失败:', error.response?.data || error.message);
  }
}

createLink();
```

---

## 核心接口清单

### 1. 创建短链接

```http
POST /api/v1/links
```

**请求体：**

```json
{
  "originalUrl": "https://example.com/very-long-url",
  "shortCode": "promo2026",
  "description": "夏季促销活动",
  "tags": ["促销", "夏季"],
  "groupId": 1,
  "expiresAt": "2026-12-31T23:59:59Z",
  "redirectType": "302",
  "seoTitle": "夏季大促 - 限时优惠",
  "seoDescription": "参与夏季促销活动，享受高达50%折扣",
  "seoImage": "https://example.com/og-image.png"
}
```

**响应：** `201 Created`

```json
{
  "id": 123,
  "shortCode": "promo2026",
  "originalUrl": "https://example.com/very-long-url",
  "clickCount": 0,
  "createdAt": "2026-03-26T10:00:00Z"
}
```

---

### 2. 获取链接列表

```http
GET /api/v1/links
```

**响应：**

```json
[
  {
    "id": 1,
    "shortCode": "abc123",
    "originalUrl": "https://example.com/page1",
    "clickCount": 1234,
    "isActive": 1,
    "createdAt": "2026-03-01T00:00:00Z"
  },
  {
    "id": 2,
    "shortCode": "promo2026",
    "originalUrl": "https://example.com/page2",
    "clickCount": 567,
    "isActive": 1,
    "createdAt": "2026-03-15T00:00:00Z"
  }
]
```

---

### 3. 更新短链接

```http
PATCH /api/v1/links/:id
```

**请求体：**（支持部分更新）

```json
{
  "description": "更新后的描述",
  "isActive": 0
}
```

---

### 4. 删除短链接

```http
DELETE /api/v1/links/:id
```

**响应：**

```json
{
  "success": true,
  "message": "Link deleted successfully"
}
```

---

## 错误处理

| 状态码 | 说明 |
|--------|------|
| 400 | 参数验证失败 |
| 401 | API Key 无效或缺失 |
| 404 | 链接不存在 |
| 409 | 短码已被占用 |
| 429 | 请求频率超限 (60次/分钟) |
| 500 | 服务器内部错误 |

**错误响应格式：**

```json
{
  "error": "Validation failed",
  "details": {
    "shortCode": {
      "_errors": ["shortCode must be at least 3 characters"]
    }
  }
}
```

---

## 速率限制

- **限制**：每 IP 每 60 秒最多 60 次请求
- **响应头**：包含限速信息

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
```

---

## 完整 API 文档

详细的 API 规范请参考 [API 文档](./api.md)。

---

## 开发者资源

| 资源 | 链接 |
|------|------|
| API 完整文档 | [docs/api.md](./api.md) |
| 安全白皮书 | [docs/security.md](./security.md) |
| GitHub | [github.com/hwdemtv/smart-link-manager](https://github.com/hwdemtv/smart-link-manager) |

---

*© 2026 Smart Link Manager*
