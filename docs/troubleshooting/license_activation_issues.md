# 激活码激活错误排查总结

## 问题现象

使用激活码激活时报错：`Unexpected token '<', "<html> <h"... is not valid JSON`

## 排查过程

### 1. License 服务器不可用
- **现象**: `km.hwdemtv.com` 和 `kami.hwdemtv.com` 返回 502 Bad Gateway
- **解决**: 调整 `LICENSE_SERVER_URLS` 顺序，将可用的 Cloudflare Workers 地址放在第一位
  `LICENSE_SERVER_URLS=https://hw-license-center.hwdemtv.workers.dev,https://km.hwdemtv.com,https://kami.hwdemtv.com`

### 2. PM2 未加载 .env 环境变量
- **现象**: 日志显示 `DATABASE_URL: Invalid input, expected string, received undefined`
- **解决**: 创建 `ecosystem.config.cjs` 配置文件，使用 `env_file` 选项加载环境变量

### 3. 端口 3000 被占用
- **现象**: 服务启动时提示端口被占用
- **解决**: 杀掉占用端口的旧 PM2 守护进程，重新启动服务

### 4. nginx 配置中 LICENSE 关键词拦截（核心问题）
- **现象**:
  - `user.getSubscription` 返回 200 ✅
  - `user.activateLicense` 返回 404 ❌
  - `user.unbindLicense` 返回 404 ❌
- **原因**: nginx 配置中的敏感文件保护规则：
  `location ~* (...|LICENSE|README.md|...)`
  使用不区分大小写的正则匹配，导致 URL 中包含 `license` 的请求被拦截返回 404
- **解决**:
  1. 从 nginx 配置中移除 `LICENSE` 关键词
  2. 修复移除后产生的 `||` 双竖杠语法错误

## 修改的文件清单

| 文件路径 | 修改内容 |
| :--- | :--- |
| `/www/wwwroot/smart-link-manager/.env` | 添加 `LICENSE_SERVER_URLS` 配置 |
| `/www/wwwroot/smart-link-manager/ecosystem.config.cjs` | 创建 PM2 配置文件 |
| `/www/server/panel/vhost/nginx/node_smart-link-manager.conf` | 移除 `LICENSE` 敏感文件匹配规则 |

## 经验总结

1. **JSON 解析错误**通常意味着后端返回了 HTML（如 nginx 错误页面），而不是 API 响应。
2. **部分 API 正常、部分 404** 时，优先检查 nginx 的 `location` 匹配规则。
3. **宝塔面板的 "敏感文件保护"** 功能通过正则匹配 URL，极易误伤包含敏感词（如 license, config）的正常 API 路径。

---
> [!NOTE]
> 原本包含在此文档中的“用户自定义域名短链无法访问”章节已迁移至 [custom_domain_access.md](./custom_domain_access.md)。
