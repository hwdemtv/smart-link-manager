# Smart Link Manager 腾讯云部署指南

---

## 一、服务器信息

| 项目 | 值 |
|------|-----|
| 云服务商 | 腾讯云 |
| IP 地址 | YOUR_SERVER_IP |
| 内网 IP | YOUR_INTERNAL_IP |
| 操作系统 | Ubuntu 22.04 LTS |
| CPU | 2 核 |
| 内存 | 3.3 GB |
| 磁盘 | 59 GB |
| SSH 密钥 | 本地路径：`YOUR_SSH_KEY_PATH` |

---

## 二、宝塔面板配置

### 2.1 安装宝塔面板

```bash
# SSH 连接服务器
ssh -i "YOUR_SSH_KEY_PATH" ubuntu@YOUR_SERVER_IP

# 安装宝塔面板
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh YOUR_BT_INSTALL_TOKEN
```

### 2.2 宝塔面板信息

| 项目 | 值 |
|------|-----|
| 面板地址 | https://YOUR_SERVER_IP:38557/YOUR_PANEL_TOKEN |
| 用户名 | YOUR_USERNAME |
| 密码 | （在面板设置中查看） |

### 2.3 宝塔防火墙放行端口

在宝塔面板 → 安全 → 添加端口规则：
- `80` - HTTP
- `443` - HTTPS
- `3000` - Node.js 应用
- `8888` - 宝塔面板默认端口
- `38557` - 当前宝塔面板端口

---

## 三、腾讯云安全组配置

在腾讯云控制台 → 云服务器 → 实例详情 → 安全组：

| 类型 | 来源 | 协议端口 | 策略 |
|------|------|----------|------|
| 自定义 | 0.0.0.0/0 | TCP:80 | 允许 |
| 自定义 | 0.0.0.0/0 | TCP:443 | 允许 |
| 自定义 | 0.0.0.0/0 | TCP:22 | 允许 |
| 自定义 | 0.0.0.0/0 | TCP:3000 | 允许 |
| 自定义 | 0.0.0.0/0 | TCP:38557 | 允许 |

**注意**：来源必须是 `0.0.0.0/0`，不能只填 `0.0.0.0`

---

## 四、环境安装

### 4.1 安装 Docker

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sudo sh

# 添加用户到 docker 组（免 sudo）
sudo usermod -aG docker $USER

# 验证安装
docker --version
```

### 4.2 安装 Node.js（用于本地构建）

```bash
# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 pnpm
sudo npm install -g pnpm

# 验证安装
node --version
pnpm --version
```

---

## 五、数据库配置

### 5.1 使用宝塔面板创建数据库

1. 宝塔面板 → 数据库 → 添加数据库
2. 配置：
   - 数据库名：`smart_link`
   - 用户名：`smart_link`
   - 密码：`YOUR_DB_PASSWORD`
   - 访问权限：本地服务器

### 5.2 手动创建（可选）

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库和用户
CREATE DATABASE smart_link CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'smart_link'@'localhost' IDENTIFIED BY 'YOUR_DB_PASSWORD';
GRANT ALL PRIVILEGES ON smart_link.* TO 'smart_link'@'localhost';
FLUSH PRIVILEGES;
```

---

## 六、项目部署

### 6.1 克隆项目

```bash
# 创建目录
sudo mkdir -p /www/wwwroot
sudo chown $USER:$USER /www/wwwroot

# 克隆代码
cd /www/wwwroot
git clone https://github.com/YOUR_USERNAME/smart-link-manager.git
cd smart-link-manager
```

### 6.2 创建环境配置

```bash
cat > .env << 'EOF'
DATABASE_URL=mysql://smart_link:YOUR_DB_PASSWORD@127.0.0.1:3306/smart_link
JWT_SECRET=YOUR_JWT_SECRET
VITE_APP_ID=http://YOUR_SERVER_IP
NODE_ENV=production
PORT=3000
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
EOF
```

### 6.3 创建 Docker Compose 配置

```bash
cat > docker-compose.yml << 'EOF'
services:
  app:
    build: .
    container_name: smart-link-app
    restart: unless-stopped
    network_mode: host
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://smart_link:YOUR_DB_PASSWORD@127.0.0.1:3306/smart_link
      JWT_SECRET: ${JWT_SECRET}
      VITE_APP_ID: http://YOUR_SERVER_IP
      PORT: 3000
    volumes:
      - ./uploads:/app/uploads
EOF
```

### 6.4 构建并启动

```bash
# 构建镜像
sudo docker compose build

# 启动服务
sudo docker compose up -d

# 查看日志
sudo docker compose logs -f app
```

---

## 七、部署方式对比

| 方式 | 适用场景 | 内存占用 | 运维难度 | 启动速度 |
|------|----------|----------|----------|----------|
| Docker | 多项目、需要隔离 | 高 (~+200MB) | 低 | 慢 (构建5-10分钟) |
| PM2 | 单项目、追求性能 | 低 | 中 | 快 (秒级) |
| 宝塔Node | 已有宝塔面板 | 低 | 低 | 快 |

---

## 八、PM2 部署方式（推荐）

PM2 是 Node.js 生产进程管理器，相比 Docker 具有更低的内存占用和更快的启动速度。

### 8.1 安装 PM2

```bash
# 安装 PM2
sudo npm install -g pm2

# 验证安装
pm2 --version
```

### 8.2 项目初始化

```bash
cd /www/wwwroot/smart-link-manager

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 创建环境配置（如果还没有）
cat > .env << 'EOF'
DATABASE_URL=mysql://smart_link:YOUR_DB_PASSWORD@127.0.0.1:3306/smart_link
JWT_SECRET=YOUR_JWT_SECRET
VITE_APP_ID=http://YOUR_SERVER_IP
NODE_ENV=production
PORT=3000
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
EOF
```

### 8.3 启动服务

```bash
# 启动应用
pm2 start dist/index.js --name smart-link

# 查看状态
pm2 status

# 查看日志
pm2 logs smart-link

# 设置开机自启
pm2 startup
pm2 save
```

### 8.4 PM2 常用命令

```bash
# 查看所有进程
pm2 status

# 查看详细信息
pm2 show smart-link

# 查看实时日志
pm2 logs smart-link

# 查看最近日志
pm2 logs smart-link --lines 100

# 重启应用
pm2 restart smart-link

# 停止应用
pm2 stop smart-link

# 删除应用
pm2 delete smart-link

# 监控面板
pm2 monit

# 保存当前进程列表
pm2 save

# 重置重启计数
pm2 reset smart-link
```

### 8.5 PM2 配置文件（可选）

创建 `ecosystem.config.js` 配置文件：

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'smart-link',
    script: 'dist/index.js',
    cwd: '/www/wwwroot/smart-link-manager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      DATABASE_URL: 'mysql://smart_link:YOUR_DB_PASSWORD@127.0.0.1:3306/smart_link',
      JWT_SECRET: 'YOUR_JWT_SECRET',
      VITE_APP_ID: 'http://YOUR_SERVER_IP'
    },
    error_file: '/www/wwwroot/smart-link-manager/logs/error.log',
    out_file: '/www/wwwroot/smart-link-manager/logs/out.log',
    log_file: '/www/wwwroot/smart-link-manager/logs/combined.log',
    time: true
  }]
}
EOF

# 创建日志目录
mkdir -p logs

# 使用配置文件启动
pm2 start ecosystem.config.js
```

### 8.6 PM2 更新部署

```bash
cd /www/wwwroot/smart-link-manager

# 拉取最新代码
git pull

# 安装依赖（如果有变化）
pnpm install

# 重新构建
pnpm build

# 重启服务
pm2 restart smart-link
```

### 8.7 从 Docker 切换到 PM2

```bash
# 停止并删除 Docker 容器
sudo docker compose down

# 确认已安装 Node.js 和 pnpm
node --version
pnpm --version

# 如果未安装，执行安装
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm pm2

# 安装依赖并构建
cd /www/wwwroot/smart-link-manager
pnpm install
pnpm build

# 启动 PM2
pm2 start dist/index.js --name smart-link
pm2 save
pm2 startup
```

### 8.8 PM2 集群模式（多进程）

对于多核服务器，可以使用集群模式：

```bash
# 根据 CPU 核心数启动多个实例
pm2 start dist/index.js --name smart-link -i max

# 或者指定实例数量
pm2 start dist/index.js --name smart-link -i 2
```

**注意**：集群模式需要确保应用是无状态的，Session 需要存储在 Redis 或数据库中。

---

## 九、Nginx 反向代理配置

### 7.1 创建 Nginx 配置

```bash
sudo tee /www/server/nginx/conf/vhost/smart-link.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # 静态资源缓存
    location /assets/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
EOF
```

### 7.2 同步到宝塔配置目录

```bash
sudo cp /www/server/nginx/conf/vhost/smart-link.conf /www/server/panel/vhost/nginx/smart-link.conf
```

### 7.3 测试并重载 Nginx

```bash
sudo nginx -t
sudo nginx -s reload
```

---

## 十、数据库迁移

### 10.1 添加缺失字段（如果需要）

```bash
mysql -u smart_link -pYOUR_DB_PASSWORD smart_link << 'EOF'
ALTER TABLE users
ADD COLUMN subscriptionTier varchar(50) NOT NULL DEFAULT 'free',
ADD COLUMN licenseKey varchar(255),
ADD COLUMN licenseExpiresAt timestamp NULL,
ADD COLUMN licenseToken text;
EOF
```

---

## 十一、常用命令

### 11.1 Docker 服务管理

```bash
# 查看容器状态
sudo docker ps

# 查看应用日志
sudo docker logs smart-link-app -f --tail 100

# 重启应用
sudo docker compose restart

# 停止应用
sudo docker compose down

# 重新构建并启动
sudo docker compose up -d --build
```

### 11.2 PM2 服务管理

```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs smart-link

# 重启应用
pm2 restart smart-link

# 停止应用
pm2 stop smart-link

# 监控面板
pm2 monit
```

### 11.3 更新部署

```bash
cd /www/wwwroot/smart-link-manager

# 拉取最新代码
git pull

# Docker 方式
sudo docker compose build app
sudo docker compose up -d

# PM2 方式
pnpm install
pnpm build
pm2 restart smart-link
```

### 11.4 Nginx 管理

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo nginx -s reload

# 查看 Nginx 状态
sudo systemctl status nginx
```

---

## 十二、访问信息

| 项目 | 值 |
|------|-----|
| 应用地址 | http://YOUR_SERVER_IP |
| 管理员账号 | admin |
| 管理员密码 | admin123 |
| 宝塔面板 | https://YOUR_SERVER_IP:38557/YOUR_PANEL_TOKEN |

---

## 十三、故障排查

### 13.1 无法访问

```bash
# 检查端口是否监听
sudo ss -tlnp | grep -E '80|3000'

# 检查防火墙
sudo ufw status
sudo iptables -L INPUT -n

# 检查腾讯云安全组是否正确配置
```

### 13.2 应用错误

**Docker 方式：**

```bash
# 查看应用日志
sudo docker logs smart-link-app --tail 50

# 进入容器调试
sudo docker exec -it smart-link-app sh
```

**PM2 方式：**

```bash
# 查看应用日志
pm2 logs smart-link --lines 50

# 查看错误日志
cat /www/wwwroot/smart-link-manager/logs/error.log

# 进入监控面板
pm2 monit
```

### 13.3 数据库连接失败

```bash
# 测试数据库连接
mysql -u smart_link -pYOUR_DB_PASSWORD smart_link -e "SELECT 1"

# 检查 MySQL 状态
sudo systemctl status mysql
```

### 13.4 PM2 进程异常退出

```bash
# 查看进程状态
pm2 status

# 查看详细错误信息
pm2 show smart-link

# 查看日志
pm2 logs smart-link --err

# 检查内存使用
pm2 monit
```

---

## 十四、目录结构

```
/www/wwwroot/smart-link-manager/
├── .env                    # 环境变量配置
├── docker-compose.yml      # Docker 编排文件
├── Dockerfile              # Docker 构建文件
├── client/                 # 前端源码
├── server/                 # 后端源码
├── shared/                 # 共享类型
├── drizzle/                # 数据库迁移
├── dist/                   # 构建输出
└── uploads/                # 上传文件目录
```

---

## 十五、部署过程中遇到的问题及解决方案

### 问题 1：Docker 端口 3306 被占用

**原因**：服务器已安装 MySQL，与 Docker 内 MySQL 冲突

**解决方案**：使用 `network_mode: host` 让容器直接使用宿主机网络，连接本地 MySQL

### 问题 2：drizzle-kit 不兼容 MySQL 5.7

**原因**：drizzle-kit 新版本查询 `check_constraints` 表，MySQL 5.7 不存在此表

**解决方案**：手动执行 SQL 迁移或升级 MySQL 到 8.0

### 问题 3：前端页面空白，JS 报 forwardRef 错误

**原因**：Vite manualChunks 配置导致模块拆分不当，依赖顺序错误

**解决方案**：将 React 相关依赖（react、react-dom、@radix-ui、lucide-react）合并到同一个 chunk

### 问题 4：登录后跳转回登录页

**原因**：HTTP + IP 地址访问时，Cookie `sameSite: "none"` 要求 `secure: true`，浏览器拒绝设置

**解决方案**：检测 IP 地址访问时使用 `sameSite: "lax"`，不强制 `secure`

### 问题 5：外网无法访问，但本地 localhost 正常

**原因**：腾讯云安全组未正确配置，入站规则格式错误

**解决方案**：确保来源为 `0.0.0.0/0`（带子网掩码），协议端口格式为 `TCP:80`

---

## 十六、快速部署脚本

### Docker 部署脚本

一键部署脚本（保存为 `deploy-docker.sh`）：

```bash
#!/bin/bash
set -e

cd /www/wwwroot/smart-link-manager

echo ">>> 拉取最新代码..."
git pull

echo ">>> 重新构建镜像..."
sudo docker compose build app

echo ">>> 重启服务..."
sudo docker compose up -d

echo ">>> 等待服务启动..."
sleep 3

echo ">>> 检查服务状态..."
sudo docker ps | grep smart-link-app

echo ">>> 部署完成！"
echo "访问地址: http://YOUR_SERVER_IP"
```

### PM2 部署脚本

一键部署脚本（保存为 `deploy-pm2.sh`）：

```bash
#!/bin/bash
set -e

cd /www/wwwroot/smart-link-manager

echo ">>> 拉取最新代码..."
git pull

echo ">>> 安装依赖..."
pnpm install

echo ">>> 构建项目..."
pnpm build

echo ">>> 重启服务..."
pm2 restart smart-link

echo ">>> 检查服务状态..."
pm2 status

echo ">>> 部署完成！"
echo "访问地址: http://YOUR_SERVER_IP"
```

---

## 十七、宝塔面板 Node 项目部署

宝塔面板提供了图形化的 Node 项目管理功能。

### 17.1 安装 Node.js 版本管理器

1. 宝塔面板 → 软件商店
2. 搜索 `Node版本管理器`
3. 点击安装

### 17.2 创建 Node 项目

1. 宝塔面板 → 网站 → Node项目
2. 点击 **添加Node项目**
3. 配置：
   - 项目名称：`smart-link-manager`
   - 项目目录：`/www/wwwroot/smart-link-manager`
   - 启动文件：`dist/index.js`
   - 项目端口：`3000`
   - Node版本：选择已安装的版本（推荐 22.x）
   - 启动模式：`production`

### 17.3 配置环境变量

在项目设置中添加环境变量：

```
DATABASE_URL=mysql://smart_link:YOUR_DB_PASSWORD@127.0.0.1:3306/smart_link
JWT_SECRET=YOUR_JWT_SECRET
VITE_APP_ID=http://YOUR_SERVER_IP
NODE_ENV=production
PORT=3000
```

### 17.4 构建和启动

```bash
# SSH 进入项目目录
cd /www/wwwroot/smart-link-manager

# 安装依赖
pnpm install

# 构建
pnpm build
```

然后在宝塔面板中点击 **启动** 按钮。

### 17.5 宝塔 Node 项目的优势

- 图形化管理界面
- 自动配置反向代理
- 内置进程守护
- 日志查看方便
- 支持多版本 Node.js 切换

---

## 十八、自定义域名 DNS 配置 (Cloudflare)

如果你需要为短链接平台配置自定义域名（例如 `s.YOUR_USERNAME.com`），建议在 Cloudflare 中使用 CNAME 记录指向你的主服务器域名。

### 18.1 配置步骤

1.  **登录 Cloudflare**：进入你的域名控制面板（例如 `YOUR_USERNAME.com`）。
2.  **添加 DNS 记录**：
    *   **类型 (Type)**: `CNAME`
    *   **名称 (Name)**: `s` (这将生成 `s.YOUR_USERNAME.com`)
    *   **目标 (Target)**: `YOUR_DOMAIN` (指向你已解析到服务器 IP 的主域名)
    *   **代理状态 (Proxy status)**: ☁️ **橙色云朵 (Proxied)**
3.  **SSL/TLS 设置**：在 Cloudflare 的 SSL 设置中，确保模式为 **Full** 或 **Full (strict)**，以支持端到端加密。

### 18.2 架构优势

*   **解耦 IP 地址**：若服务器 IP (`YOUR_SERVER_IP`) 发生变更，你只需修改 `YOUR_DOMAIN` 的 A 记录。所有的 CNAME 记录会自动同步生效，无需逐个修改。
*   **安全防护**：配合 Cloudflare 代理，可以有效隐藏后端真实服务器 IP，降低被攻击风险。

### 18.3 系统关键步骤

完成解析后，你**必须**在 Smart Link Manager 管理后台执行以下操作：
1.  进入 **「域名管理」**。
2.  点击 **「添加域名」**。
3.  输入你的自定义域名 `s.YOUR_USERNAME.com` 并保存。
4.  （可选）在 **「平台设置」** 中将其设为默认域名。

