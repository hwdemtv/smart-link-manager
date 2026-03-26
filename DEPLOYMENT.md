# Smart Link Manager 生产环境部署指南

本指南涵盖多种部署方案，从快速部署到企业级高可用架构。

## 📋 目录

- [环境要求](#环境要求)
- [方案一：Docker 部署 (推荐)](#方案一docker-部署推荐)
- [方案二：宝塔面板部署](#方案二宝塔面板部署)
- [方案三：手动部署](#方案三手动部署)
- [数据库配置](#数据库配置)
- [Redis 配置](#redis-配置)
- [Nginx 反向代理](#nginx-反向代理)
- [SSL 证书配置](#ssl-证书配置)
- [监控与日志](#监控与日志)
- [常见问题](#常见问题)

---

## 环境要求

### 最低配置
| 组件 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | 18.x+ | 推荐 20.x 或 22.x LTS |
| MySQL | 5.7+ | 推荐 8.0+ |
| Redis | 6.0+ | 用于任务队列 |
| 内存 | 1GB+ | 推荐 2GB+ |
| 存储 | 10GB+ | 含数据库与上传文件 |

### 推荐云服务商
- **腾讯云**：国内访问优化，宝塔面板兼容性好
- **阿里云**：企业级稳定性
- **AWS / Azure**：海外用户推荐

---

## 方案一：Docker 部署 (推荐)

Docker 部署确保开发与生产环境一致性，解决跨平台兼容性问题。

### 1. 安装 Docker

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**CentOS/RHEL:**
```bash
yum install -y docker
systemctl enable docker
systemctl start docker
```

### 2. 准备项目文件

```bash
# 克隆或上传项目
git clone https://github.com/your-repo/smart-link-manager.git
cd smart-link-manager

# 复制环境变量模板
cp .env.example .env
```

### 3. 配置环境变量

编辑 `.env` 文件：

```env
# 数据库连接
DATABASE_URL=mysql://用户名:密码@数据库地址:3306/数据库名

# JWT 密钥 (必须 32 位以上随机字符串)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters

# 应用标识 (用于生成短链接)
VITE_APP_ID=https://your-domain.com

# 运行环境
NODE_ENV=production
PORT=3000

# Redis 配置 (必填)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 默认管理员 (可选)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your-secure-password
```

### 4. 启动服务

**使用 docker-compose (推荐):**

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

**独立运行 MySQL + Redis:**

如果已有外部 MySQL 和 Redis，修改 `docker-compose.yml`：

```yaml
services:
  app:
    build: .
    container_name: smart-link-app
    restart: unless-stopped
    network_mode: host  # 使用宿主机网络，直连本地 MySQL/Redis
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
```

### 5. Docker 常用命令

```bash
# 查看容器状态
docker ps

# 查看实时日志
docker logs -f smart-link-app

# 进入容器调试
docker exec -it smart-link-app sh

# 重启容器
docker restart smart-link-app

# 更新部署
git pull
docker-compose up -d --build
```

---

## 方案二：宝塔面板部署

适合国内服务器，图形化管理更友好。

### 0. 安装宝塔面板

**Ubuntu:**
```bash
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec
```

**CentOS:**
```bash
yum install -y wget && wget -O install.sh http://download.bt.cn/install/install_6.0.sh && sh install.sh
```

---

### 1. 安装基础软件

在宝塔面板 **”软件商店”** 安装：
- **MySQL 5.7+** (推荐 8.0)
- **Redis 6.0+**
- **Nginx**
- **Node.js 版本管理器**
- **Docker** (可选，用于 Docker 方案)

### 2. 安装 Node.js

1. 打开 **Node.js 版本管理器** -> **设置** -> **更新版本列表**
2. 安装 **v20.x** 或 **v22.x** LTS 版本
3. **关键**：在 **”命令行版本”** 下拉框中选择已安装的版本

### 3. 安装 pnpm

```bash
npm install -g pnpm
```

### 4. 上传项目代码

1. 在 `/www/wwwroot/` 创建项目目录
2. 上传源码（**排除 `node_modules` 和 `dist`**）
3. 创建 `.env` 文件配置环境变量

### 5. 构建项目

```bash
cd /www/wwwroot/smart-link-manager
pnpm install
pnpm run build
```

### 6. 配置 Node 项目

1. 宝塔面板 -> **网站** -> **Node项目** -> **添加项目**
2. 配置项：
   - **项目目录**：`/www/wwwroot/smart-link-manager`
   - **启动选项**：自定义命令 `node dist/index.js`
   - **项目端口**：`3000`
   - **环境变量**：填入 `.env` 中的所有键值对

---

## 方案三：手动部署

适合自有服务器或非宝塔环境。

### 1. 安装依赖

```bash
# Node.js (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# pnpm
npm install -g pnpm

# PM2 (进程管理)
npm install -g pm2
```

### 2. 部署项目

```bash
# 克隆项目
git clone https://github.com/your-repo/smart-link-manager.git
cd smart-link-manager

# 安装依赖并构建
pnpm install
pnpm run build

# 配置环境变量
cp .env.example .env
nano .env  # 编辑配置
```

### 3. 使用 PM2 启动

```bash
# 启动应用
pm2 start dist/index.js --name smart-link-manager

# 查看状态
pm2 status

# 查看日志
pm2 logs smart-link-manager

# 设置开机自启
pm2 startup
pm2 save
```

### 4. PM2 常用命令

```bash
pm2 restart smart-link-manager  # 重启
pm2 stop smart-link-manager     # 停止
pm2 delete smart-link-manager   # 删除
pm2 monit                       # 监控面板
```

---

## 数据库配置

### 创建数据库

```sql
-- 创建数据库
CREATE DATABASE smart_link CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建用户
CREATE USER 'smart_link'@'localhost' IDENTIFIED BY 'your-secure-password';

-- 授权
GRANT ALL PRIVILEGES ON smart_link.* TO 'smart_link'@'localhost';
FLUSH PRIVILEGES;
```

### 初始化表结构

**方法 A：使用 SQL 文件 (推荐)**

```bash
# 导入初始化 SQL
mysql -u smart_link -p smart_link < init_db.sql
```

**方法 B：使用 Drizzle CLI**

```bash
# 在本地开发机，连接生产数据库
DATABASE_URL=mysql://smart_link:password@production-host:3306/smart_link pnpm run db:push
```

### 数据库备份

**手动备份:**
```bash
mysqldump -u smart_link -p smart_link > backup_$(date +%Y%m%d).sql
```

**定时备份 (宝塔面板):**
1. 计划任务 -> 添加任务
2. 任务类型：备份网站
3. 执行周期：每天凌晨 3:00

---

## Redis 配置

Smart Link Manager 使用 Redis 作为任务队列后端，处理定时任务和批量操作。

### 安装 Redis

**宝塔面板:**
软件商店 -> 搜索 “Redis” -> 安装

**Ubuntu/Debian:**
```bash
apt update
apt install redis-server
systemctl enable redis-server
```

**CentOS:**
```bash
yum install redis
systemctl enable redis
systemctl start redis
```

### 配置 Redis

编辑 `/etc/redis/redis.conf`:

```conf
# 绑定地址 (生产环境建议只绑定本地)
bind 127.0.0.1

# 设置密码 (强烈推荐)
requirepass your-redis-password

# 最大内存
maxmemory 256mb
maxmemory-policy allkeys-lru
```

重启 Redis：
```bash
systemctl restart redis
```

### 验证连接

```bash
# 测试连接
redis-cli -a your-redis-password ping
# 应返回 PONG
```

在应用日志中看到以下信息表示连接成功：
```
[Jobs] Redis connected, job queues enabled
```

---

## Nginx 反向代理

### 基础配置

创建 Nginx 配置文件 `/etc/nginx/sites-available/smart-link-manager`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 客户端请求体大小限制
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存
    location /assets/ {
        proxy_pass http://127.0.0.1:3000/assets/;
        proxy_cache_valid 200 30d;
        add_header Cache-Control “public, immutable”;
    }
}
```

启用配置：
```bash
ln -s /etc/nginx/sites-available/smart-link-manager /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 宝塔面板配置

1. 网站 -> 添加站点 -> 输入域名
2. 站点设置 -> 反向代理 -> 添加反向代理
   - 目标 URL: `http://127.0.0.1:3000`
   - 发送域名: `$host`

---

## SSL 证书配置

### Let's Encrypt 免费证书

**使用 Certbot:**
```bash
# 安装 Certbot
apt install certbot python3-certbot-nginx

# 申请证书
certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
certbot renew --dry-run
```

**宝塔面板:**
站点设置 -> SSL -> Let's Encrypt -> 申请证书

### 手动配置 SSL

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 优化配置
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # 现代加密套件
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security “max-age=63072000” always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... 其他配置
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 监控与日志

### 应用日志

**PM2 日志:**
```bash
# 查看日志
pm2 logs smart-link-manager

# 日志文件位置
~/.pm2/logs/smart-link-manager-out.log
~/.pm2/logs/smart-link-manager-error.log
```

**Docker 日志:**
```bash
docker logs -f smart-link-app --tail 100
```

### 健康检查

添加健康检查端点监控：

```bash
# 简单检查
curl http://localhost:3000/api/health

# 定时检查脚本
*/5 * * * * curl -f http://localhost:3000/api/health || systemctl restart smart-link-manager
```

### 性能监控

**PM2 监控:**
```bash
pm2 monit
```

**宝塔监控:**
面板首页 -> 监控 -> 开启监控

---

## 常见问题

### 部署问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **502 Bad Gateway** | Node 进程未启动或端口被占用 | 检查进程状态 `pm2 status` 或 `docker ps`，查看应用日志 |
| **ECONNREFUSED** | 数据库/Redis 连接失败 | 检查服务状态，确认连接地址和密码正确 |
| **Unknown column** | 数据库表结构不匹配 | 重新导入 `init_db.sql` 或执行 `drizzle-kit push` |
| **JWT_SECRET too short** | JWT 密钥长度不足 | 确保 JWT_SECRET 至少 32 位 |
| **内存溢出 (OOM)** | Node 进程内存不足 | 增加 `--max-old-space-size` 或升级服务器配置 |

### 运行问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **短链跳转 404** | 短码不存在或已删除 | 检查数据库 links 表，确认 shortCode 正确 |
| **二维码生成失败** | uploads 目录权限问题 | `chmod 755 uploads` 或 `chown -R www:www uploads` |
| **统计数据不更新** | Redis 连接断开 | 检查 Redis 状态，查看应用日志中的 Redis 错误 |
| **登录报错 TRPCClientError** | 数据库字段缺失 | 检查 users 表是否有 loginMethod 等新字段 |

### 性能优化

**数据库优化:**
```sql
-- 添加索引（如果不存在）
CREATE INDEX idx_links_user_deleted ON links(userId, isDeleted);
CREATE INDEX idx_stats_link_clicked ON link_stats(linkId, clickedAt);
```

**Node.js 优化:**
```bash
# 启动时设置内存限制
NODE_OPTIONS=”--max-old-space-size=2048” pm2 start dist/index.js
```

**Nginx 优化:**
```nginx
# 启用 gzip 压缩
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# 启用缓存
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
```

---

## 更新部署

### Docker 更新

```bash
cd /www/wwwroot/smart-link-manager
git pull origin main
docker-compose down
docker-compose up -d --build
```

### PM2 更新

```bash
cd /www/wwwroot/smart-link-manager
git pull origin main
pnpm install
pnpm run build
pm2 restart smart-link-manager
```

### 数据库迁移

如果更新涉及数据库结构变更：
```bash
# 方式 1: 使用新的 SQL 文件
mysql -u smart_link -p smart_link < migration.sql

# 方式 2: 使用 Drizzle
pnpm run db:push
```

---

## 安全建议

1. **定期更新依赖**: `pnpm update` 处理安全漏洞
2. **强密码策略**: 数据库、Redis、JWT 密钥均使用强密码
3. **限制端口暴露**: 仅开放 80/443，数据库和 Redis 仅本地访问
4. **启用防火墙**: 使用 ufw 或宝塔防火墙
5. **定期备份**: 数据库和 uploads 目录
6. **监控日志**: 设置异常登录告警

---

> [!TIP]
> **资源维护**：定期备份以下目录和文件：
> - `uploads/` - 用户上传的二维码和图片
> - `.env` - 环境配置 (注意保密)
> - 数据库 - 使用 mysqldump 定期导出

---

## 相关文档

- [SEO 优化实施方案](./seo-optimization-plan.md) - 搜索引擎优化详细方案
- [首页优化方案](./homepage-optimization-plan.md) - 首页转化与用户体验优化
