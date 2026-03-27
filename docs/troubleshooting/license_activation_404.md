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

# 用户自定义域名短链无法访问

## 问题现象

用户自定义域名（如 `l.hwdemtv.com`、`s.hwdemtv.com`）的短链无法访问，提示重定向次数过多或连接被拒绝。

## 问题原因

1. **nginx 未配置默认 server block**：自定义域名没有对应的 nginx 配置，请求无法到达后端
2. **后端自定义域名处理逻辑**：后端会根据 `Host` 头判断是否为自定义域名，并在数据库中查询对应短链

## 解决方案

### 添加 nginx 默认 server block

创建 `/www/server/panel/vhost/nginx/default-node.conf`：

```nginx
# 默认 server - 将未知域名的请求转发到 Node.js 后端
# 用于处理用户自定义域名的短链
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;

    # SSL 证书（使用已有证书）
    ssl_certificate /www/server/panel/vhost/cert/smart-link-manager/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/smart-link-manager/privkey.pem;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_ciphers EECDH+CHACHA20:EECDH+CHACHA20-draft:EECDH+AES128:RSA+AES128:EECDH+AES256:RSA+AES256:EECDH+3DES:RSA+3DES:!MD5;
    ssl_prefer_server_ciphers on;

    # 禁止访问敏感文件（同主站配置）
    location ~* (\.user.ini|\.htaccess|\.htpasswd|\.env.*|\.project|\.bashrc|\.bash_profile|\.bash_logout|\.DS_Store|\.gitignore|\.gitattributes|README\.md|CLAUDE\.md|CHANGELOG\.md|CHANGELOG|CONTRIBUTING\.md|TODO\.md|FAQ\.md|composer\.json|composer\.lock|package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|\.\w+~|\.swp|\.swo|\.bak(up)?|\.old|\.tmp|\.temp|\.log|\.sql(\.gz)?|docker-compose\.yml|docker\.env|Dockerfile|\.csproj|\.sln|Cargo\.toml|Cargo\.lock|go\.mod|go\.sum|phpunit\.xml|pom\.xml|build\.gradl|pyproject\.toml|requirements\.txt|application(-\w+)?\.(ya?ml|properties))$ {
        return 404;
    }

    # 禁止访问敏感目录
    location ~* /(\.git|\.svn|\.bzr|\.vscode|\.claude|\.idea|\.ssh|\.github|\.npm|\.yarn|\.pnpm|\.cache|\.husky|\.turbo|\.next|\.nuxt|node_modules|runtime)/ {
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host:$server_port;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Host $host:$server_port;
        proxy_set_header X-Scheme $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 86400s;
        proxy_send_timeout 30s;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    access_log /www/wwwlogs/default-node.log;
    error_log /www/wwwlogs/default-node.error.log;
}
```

### 用户自定义域名配置步骤

用户需要完成以下配置：

1. **DNS 配置**：在域名 DNS 管理中添加 CNAME 记录
   - 名称：自定义前缀（如 `l`、`s`）
   - 目标：`s.hubinwei.top`（平台主域名）

2. **Cloudflare 代理**（推荐）
   - 开启 Cloudflare 代理（橙色云朵）
   - SSL/TLS 模式设置为「完全」
   - Cloudflare 会自动为域名签发 SSL 证书

3. **平台验证域名**
   - 用户在平台「域名管理」中添加自定义域名
   - 完成域名所有权验证

## 工作原理

```
用户访问 https://l.hwdemtv.com/s/abc123
         ↓
    Cloudflare（处理 SSL，转发请求）
         ↓
    nginx default_server（匹配未知域名）
         ↓
    Node.js 后端（根据 Host 头查询数据库）
         ↓
    查询 links 表：customDomain='l.hwdemtv.com' AND shortCode='abc123'
         ↓
    返回重定向或落地页
```

## 注意事项

1. **SSL 证书**：服务器证书只包含主域名，自定义域名需要通过 Cloudflare 代理来处理 SSL
2. **敏感文件规则**：默认 server block 需要与主站保持一致的敏感文件保护规则
3. **日志分离**：默认 server 使用独立的日志文件，便于排查问题
