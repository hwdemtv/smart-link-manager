# Smart Link Manager 腾讯云部署指南

---

## 一、服务器信息

| 项目 | 值 |
|------|-----|
| 云服务商 | 腾讯云 |
| IP 地址 | 43.156.55.3 |
| 内网 IP | 10.3.0.17 |
| 操作系统 | Ubuntu 22.04 LTS |
| CPU | 2 核 |
| 内存 | 3.3 GB |
| 磁盘 | 59 GB |
| SSH 密钥 | 本地路径：`D:\Users\hwdem\Downloads\PC.pem` |

---

## 二、宝塔面板配置

### 2.1 安装宝塔面板

```bash
# SSH 连接服务器
ssh -i "D:\Users\hwdem\Downloads\PC.pem" ubuntu@43.156.55.3

# 安装宝塔面板
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && sudo bash install.sh ed8484bec
```

### 2.2 宝塔面板信息

| 项目 | 值 |
|------|-----|
| 面板地址 | https://43.156.55.3:38557/6b245c2f |
| 用户名 | hwdemtv |
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
   - 密码：`smartlink123`
   - 访问权限：本地服务器

### 5.2 手动创建（可选）

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库和用户
CREATE DATABASE smart_link CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'smart_link'@'localhost' IDENTIFIED BY 'smartlink123';
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
git clone https://github.com/hwdemtv/smart-link-manager.git
cd smart-link-manager
```

### 6.2 创建环境配置

```bash
cat > .env << 'EOF'
DATABASE_URL=mysql://smart_link:smartlink123@127.0.0.1:3306/smart_link
JWT_SECRET=smart-link-jwt-secret-your-random-string-32-chars
VITE_APP_ID=http://43.156.55.3
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
      DATABASE_URL: mysql://smart_link:smartlink123@127.0.0.1:3306/smart_link
      JWT_SECRET: ${JWT_SECRET}
      VITE_APP_ID: http://43.156.55.3
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

## 七、Nginx 反向代理配置

### 7.1 创建 Nginx 配置

```bash
sudo tee /www/server/nginx/conf/vhost/smart-link.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name 43.156.55.3;

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

## 八、数据库迁移

### 8.1 添加缺失字段（如果需要）

```bash
mysql -u smart_link -psmartlink123 smart_link << 'EOF'
ALTER TABLE users
ADD COLUMN subscriptionTier varchar(50) NOT NULL DEFAULT 'free',
ADD COLUMN licenseKey varchar(255),
ADD COLUMN licenseExpiresAt timestamp NULL,
ADD COLUMN licenseToken text;
EOF
```

---

## 九、常用命令

### 9.1 服务管理

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

### 9.2 更新部署

```bash
cd /www/wwwroot/smart-link-manager

# 拉取最新代码
git pull

# 重新构建
sudo docker compose build app

# 重启服务
sudo docker compose up -d
```

### 9.3 Nginx 管理

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo nginx -s reload

# 查看 Nginx 状态
sudo systemctl status nginx
```

---

## 十、访问信息

| 项目 | 值 |
|------|-----|
| 应用地址 | http://43.156.55.3 |
| 管理员账号 | admin |
| 管理员密码 | admin123 |
| 宝塔面板 | https://43.156.55.3:38557/6b245c2f |

---

## 十一、故障排查

### 11.1 无法访问

```bash
# 检查端口是否监听
sudo ss -tlnp | grep -E '80|3000'

# 检查防火墙
sudo ufw status
sudo iptables -L INPUT -n

# 检查腾讯云安全组是否正确配置
```

### 11.2 应用错误

```bash
# 查看应用日志
sudo docker logs smart-link-app --tail 50

# 进入容器调试
sudo docker exec -it smart-link-app sh
```

### 11.3 数据库连接失败

```bash
# 测试数据库连接
mysql -u smart_link -psmartlink123 smart_link -e "SELECT 1"

# 检查 MySQL 状态
sudo systemctl status mysql
```

---

## 十二、目录结构

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

## 十三、部署过程中遇到的问题及解决方案

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

## 十四、快速部署脚本

一键部署脚本（保存为 `deploy.sh`）：

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
echo "访问地址: http://43.156.55.3"
```
