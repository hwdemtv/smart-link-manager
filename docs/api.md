# Smart Link Manager OpenAPI 规范 (v1.1)

Smart Link Manager (SLM) 提供标准化的 REST API，方便开发者集成短链接管理能力。

## 目录

- [认证方式](#认证方式)
- [API Key 管理](#api-key-管理)
- [核心接口](#核心接口)
- [请求/响应示例](#请求响应示例)
- [错误处理](#错误处理)
- [速率限制](#速率限制)
- [SDK 集成](#sdk-集成)

---

## 认证方式

所有 REST API 请求需在 Header 中携带 API Key：

```http
Authorization: Bearer <YOUR_API_KEY>
```

### 获取 API Key

1. 登录 Smart Link Manager 管理后台
2. 进入 **设置** -> **API Keys**
3. 点击 **创建新密钥**
4. 设置密钥名称（如：生产环境、测试环境）
5. 可选：设置过期时间
6. 保存生成的密钥（**注意：密钥只显示一次，请妥善保管**）

### API Key 格式

```
slm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- 前缀 `slm_` 标识来源
- `live` 表示生产环境密钥
- 后续为 32 位随机字符串

---

## API Key 管理

### 通过 Web 界面管理

| 操作 | 路径 |
|------|------|
| 查看密钥列表 | 设置 -> API Keys |
| 创建新密钥 | 点击"创建新密钥"按钮 |
| 禁用密钥 | 点击密钥旁的"禁用"按钮 |
| 删除密钥 | 点击密钥旁的"删除"按钮 |

### 密钥安全建议

1. **不要硬编码**：将密钥存储在环境变量或密钥管理服务中
2. **定期轮换**：建议每 90 天更换一次密钥
3. **最小权限**：为不同环境使用不同的密钥
4. **监控使用**：定期检查密钥的最后使用时间和调用次数

---

## 核心接口

### 基础 URL

```
https://your-domain.com/api/v1
```

### 1. 获取链接列表

获取当前用户下的所有短链接。

```http
GET /api/v1/links
```

**请求头**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| Authorization | string | 是 | Bearer Token |

**响应**

```json
[
  {
    "id": 1,
    "shortCode": "abc123",
    "originalUrl": "https://example.com/very-long-url",
    "customDomain": null,
    "description": "营销活动链接",
    "isActive": 1,
    "clickCount": 1234,
    "tags": ["营销", "活动"],
    "createdAt": "2026-03-20T10:00:00Z",
    "expiresAt": null
  }
]
```

---

### 2. 创建短链接

创建新的短链接。

```http
POST /api/v1/links
```

**请求头**

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| Authorization | string | 是 | Bearer Token |
| Content-Type | string | 是 | application/json |

**请求体参数**

#### 基础参数 (必填)

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| originalUrl | string | 是 | 目标长链接 |
| shortCode | string | 是 | 自定义短码 (3-20位，字母/数字/下划线/-) |

#### 基础参数 (可选)

| 参数 | 类型 | 说明 |
|------|------|------|
| groupId | number | 所属分组 ID |
| description | string | 备注说明 |
| tags | string[] | 标签数组 |
| isActive | number | 是否启用 (1=启用, 0=禁用) |

#### 高级配置

| 参数 | 类型 | 说明 |
|------|------|------|
| expiresAt | string | 过期时间 (ISO 8601 格式) |
| password | string | 访问密码 |

#### A/B 测试配置

| 参数 | 类型 | 说明 |
|------|------|------|
| abTestEnabled | number | 开启 A/B 测试 (0/1) |
| abTestUrl | string | 变体 B 的目标 URL |
| abTestRatio | number | 变体 A 流量比例 (0-100) |

#### SEO 与社交分享

| 参数 | 类型 | 说明 |
|------|------|------|
| shareSuffix | string | 社交分享路径后缀 |
| seoTitle | string | SEO 标题 |
| seoDescription | string | SEO 描述 |
| seoImage | string | SEO 预览图片 URL |
| seoKeywords | string | SEO 关键词 (逗号分隔) |
| seoPriority | number | Sitemap 优先级 (0-100) |
| noIndex | number | 禁止搜索引擎索引 (0/1) |
| redirectType | string | 重定向状态码 ("301", "302", "307", "308") |
| canonicalUrl | string | Canonical URL |
| ogVideoUrl | string | Open Graph 视频预览 URL |
| ogVideoWidth | number | OG 视频宽度 |
| ogVideoHeight | number | OG 视频高度 |

**响应示例**

```json
{
  "id": 123,
  "userId": 1,
  "shortCode": "promo2026",
  "originalUrl": "https://example.com/summer-promotion",
  "customDomain": null,
  "description": "夏季促销活动",
  "isActive": 1,
  "clickCount": 0,
  "tags": ["促销", "夏季"],
  "groupId": 5,
  "abTestEnabled": 1,
  "abTestUrl": "https://example.com/summer-promo-v2",
  "abTestRatio": 70,
  "seoTitle": "夏季大促销 - 限时优惠",
  "seoDescription": "参与夏季促销活动，享受高达50%折扣",
  "redirectType": "302",
  "createdAt": "2026-03-25T14:30:00Z",
  "updatedAt": "2026-03-25T14:30:00Z"
}
```

---

### 3. 更新短链接

更新现有短链接的部分信息。

```http
PATCH /api/v1/links/:id
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 链接 ID |

**请求体**

支持对 [创建接口](#2-创建短链接) 中的所有字段进行局部更新。

```json
{
  "description": "更新后的描述",
  "isActive": 0,
  "tags": ["已归档"]
}
```

**响应**

返回更新后的完整链接对象。

---

### 4. 删除短链接

永久删除指定短链接。

```http
DELETE /api/v1/links/:id
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | number | 链接 ID |

**响应**

```json
{
  "success": true,
  "message": "Link deleted successfully"
}
```

---

## 请求/响应示例

### cURL 示例

```bash
# 创建短链接
curl -X POST https://s.yourdomain.com/api/v1/links \
  -H "Authorization: Bearer slm_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "originalUrl": "https://example.com/very-long-url-to-shorten",
    "shortCode": "mycode",
    "description": "测试链接",
    "tags": ["测试"]
  }'

# 获取链接列表
curl -X GET https://s.yourdomain.com/api/v1/links \
  -H "Authorization: Bearer slm_live_your_api_key_here"

# 更新链接
curl -X PATCH https://s.yourdomain.com/api/v1/links/123 \
  -H "Authorization: Bearer slm_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"isActive": 0}'

# 删除链接
curl -X DELETE https://s.yourdomain.com/api/v1/links/123 \
  -H "Authorization: Bearer slm_live_your_api_key_here"
```

### JavaScript (fetch) 示例

```javascript
const API_BASE = 'https://s.yourdomain.com/api/v1';
const API_KEY = 'slm_live_your_api_key_here';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

// 创建短链接
async function createLink(originalUrl, shortCode) {
  const response = await fetch(`${API_BASE}/links`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      originalUrl,
      shortCode,
      tags: ['auto-generated']
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create link');
  }

  return response.json();
}

// 使用示例
createLink('https://example.com/product/12345', 'prod123')
  .then(link => console.log('Created:', link))
  .catch(err => console.error('Error:', err.message));
```

### Python (requests) 示例

```python
import requests

API_BASE = 'https://s.yourdomain.com/api/v1'
API_KEY = 'slm_live_your_api_key_here'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# 创建短链接
def create_link(original_url, short_code):
    response = requests.post(
        f'{API_BASE}/links',
        headers=headers,
        json={
            'originalUrl': original_url,
            'shortCode': short_code
        }
    )
    response.raise_for_status()
    return response.json()

# 使用示例
link = create_link('https://example.com/product/12345', 'prod123')
print(f"Created: {link}")
```

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 认证失败 (API Key 无效或缺失) |
| 404 | 资源不存在 |
| 409 | 资源冲突 (如短码已存在) |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |

### 错误响应格式

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

### 常见错误

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Missing or invalid Authorization header` | 未提供 API Key | 添加 Authorization 请求头 |
| `Invalid or inactive API Key` | API Key 无效或已禁用 | 检查密钥是否正确、是否已过期 |
| `shortCode already exists` | 短码已被占用 | 更换其他短码 |
| `Validation failed` | 参数格式错误 | 检查参数类型和格式 |

---

## 速率限制

- **限制**: 每 IP 每 60 秒最多 60 次请求
- **响应头**: 包含限速信息

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1711372800
```

**超限响应**

```json
{
  "error": "Too Many Requests",
  "message": "API rate limit exceeded. Please slow down."
}
```

---

## SDK 集成

### TypeScript 类型定义

```typescript
interface Link {
  id: number;
  userId: number;
  shortCode: string;
  originalUrl: string;
  customDomain: string | null;
  description: string | null;
  isActive: number;
  clickCount: number;
  tags: string[];
  groupId: number | null;
  expiresAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoImage: string | null;
  redirectType: '301' | '302' | '307' | '308';
  abTestEnabled: number;
  abTestUrl: string | null;
  abTestRatio: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateLinkInput {
  originalUrl: string;
  shortCode: string;
  description?: string;
  tags?: string[];
  groupId?: number;
  expiresAt?: string;
  password?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  redirectType?: '301' | '302' | '307' | '308';
  abTestEnabled?: number;
  abTestUrl?: string;
  abTestRatio?: number;
}

interface UpdateLinkInput extends Partial<CreateLinkInput> {
  isActive?: number;
}
```

### tRPC 内部调用

如果您在同一项目中使用 tRPC，可以直接调用：

```typescript
// 前端组件中
const createLink = trpc.links.create.useMutation();
await createLink.mutateAsync({
  originalUrl: 'https://example.com',
  shortCode: 'mycode'
});
```

---

## Webhook (规划中)

未来版本将支持 Webhook 通知，用于：
- 链接点击事件
- 链接过期提醒
- 配额预警

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.1 | 2026-03 | 新增 SEO 配置、A/B 测试参数 |
| v1.0 | 2026-01 | 初始版本 |
