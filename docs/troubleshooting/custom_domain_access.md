# 用户自定义域名短链无法访问

## 问题现象

用户自定义域名（如 `l.hwdemtv.com`、`s.hwdemtv.com`）的短链无法访问，提示“重定向次数过多”或连接被拒绝。

## 问题原因

1. **nginx 未配置默认 server block**：自定义域名没有对应的 nginx 配置，请求无法到达后端。
2. **后端 `VITE_APP_ID` 配置冗余 (核心原因)**：`VITE_APP_ID` 中包含了协议头（如 `http://`）或末尾斜杠，导致后端在对比 `Host` 头时匹配失败，误将其识别为自定义域名进而产生无限循环查找。
3. **黑名单中间件环路**：IP 在被拦截后重定向到 `/error`，但 `/error` 页面自身又触发了黑名单拦截。

## 解决方案

### 1. 升级后端逻辑 (推荐)
确保后端版本在 1.2.0+。系统已内置归一化逻辑，会自动剥离 `VITE_APP_ID` 和 `Host` 中的协议、端口及斜杠，极大增强了容错性。

### 2. 修正环境变量
检查 `.env` 文件，确保 `VITE_APP_ID` 仅包含纯域名：
- ❌ 错误：`VITE_APP_ID=https://s.hubinwei.top/`
- ✅ 正确：`VITE_APP_ID=s.hubinwei.top`

### 3. 配置 nginx 默认 server block
创建 `/www/server/panel/vhost/nginx/default-node.conf`，确保未知域名能转发至后端：

```nginx
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;
    # ... 证书配置与主站保持一致 ...
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host; # 传递原始请求域名
        # ... 其他 proxy 参数 ...
    }
}
```

## 修复案例：s.hwdemtv.com 循环重定向

在 2026-03-27 的排查中，发现由于生产环境 `VITE_APP_ID` 带有协议头，导致系统在 `server/_core/index.ts` 中无法正确跳过主域名判断。
**修复逻辑参考：**
```typescript
// 归一化 appId 与 incoming host
const normalizedAppId = VITE_APP_ID.replace(/^https?:\/\//, "").replace(/\/+$/, "");
const hostHeader = req.headers.host || "";
// 剥离端口后进行严格比对
const isPrimaryDomain = hostWithoutPort === appIdWithoutPort;
```

## 验证步骤
1. 修改 `.env` 后通过 `pm2 restart all` 重启。
2. 访问主域名根目录，确认不再重定向至 `/error`。
3. 观察 `server/redirectHandler.ts` 中的诊断日志。
