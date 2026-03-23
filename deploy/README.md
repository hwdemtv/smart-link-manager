# Smart Link Manager - 腾讯云部署指南

## 服务器信息

| 项目 | 值 |
|------|-----|
| IP 地址 | 43.156.55.3 |
| 用户名 | ubuntu |
| 密码 | `!9V)gDP/k?n+6=4` |
| 系统 | Ubuntu 22.04 LTS |

---

## 方式一：快速部署 (推荐)

### 步骤 1: 配置 SSH 密钥 (首次使用)

```powershell
# 1. 生成 SSH 密钥 (如果没有)
ssh-keygen -t ed25519

# 2. 复制公钥到服务器
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh ubuntu@43.156.55.3 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# 3. 测试连接
ssh ubuntu@43.156.55.3
```

### 步骤 2: 运行部署脚本

```powershell
# 进入项目目录
cd D:\软件开发\smart-link-manager

# 执行完整部署
.\deploy\deploy.ps1 -Action full
```

### 步骤 3: 访问应用

- **地址**: http://43.156.55.3
- **用户名**: admin
- **密码**: Admin@123456

---

## 方式二：手动部署

### 1. 连接服务器

```bash
ssh ubuntu@43.156.55.3
# 密码: !9V)gDP/k?n+6=4
```

### 2. 安装 Docker

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 添加用户到 docker 组
sudo usermod -aG docker $USER

# 重新登录生效
exit
# 重新 ssh 连接
```

### 3. 创建项目目录

```bash
sudo mkdir -p /opt/smart-link-manager
sudo chown $USER:$USER /opt/smart-link-manager
cd /opt/smart-link-manager
```

### 4. 上传项目文件

在本地电脑执行:

```powershell
# 使用 scp 上传
scp -r D:\软件开发\smart-link-manager/* ubuntu@43.156.55.3:/opt/smart-link-manager/
```

或使用 WinSCP / FileZilla 图形化工具上传。

### 5. 创建环境配置

```bash
cd /opt/smart-link-manager

# 创建 .env 文件
cat > .env << 'EOF'
DATABASE_URL=mysql://smartlink:YourDbPassword123@mysql:3306/smart_link
VITE_APP_ID=http://43.156.55.3
JWT_SECRET=your-random-jwt-secret-32-chars
NODE_ENV=production
PORT=3000
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=Admin@123456
DB_ROOT_PASSWORD=RootPassword123
DB_PASSWORD=YourDbPassword123
EOF
```

### 6. 启动服务

```bash
cd /opt/smart-link-manager
docker compose up -d --build
```

### 7. 查看日志

```bash
docker compose logs -f app
```

---

## 常用命令

### 服务管理

```bash
# 查看状态
docker compose ps

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

### 日志查看

```bash
# 查看应用日志
docker compose logs -f app

# 查看数据库日志
docker compose logs -f mysql

# 查看最近 100 行
docker compose logs --tail=100 app
```

### 更新代码

```bash
# 1. 本地更新代码后上传
scp -r ./server ./client ubuntu@43.156.55.3:/opt/smart-link-manager/

# 2. 重启服务
ssh ubuntu@43.156.55.3 "cd /opt/smart-link-manager && docker compose restart app"
```

---

## 配置域名 (可选)

### 1. 解析域名

在域名服务商添加 A 记录:
- 主机记录: `s` (或其他)
- 记录类型: A
- 记录值: `43.156.55.3`

### 2. 安装 Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 3. 申请 SSL 证书

```bash
sudo certbot --nginx -d s.yourdomain.com
```

### 4. 自动续期

```bash
sudo crontab -e
# 添加:
0 3 * * * certbot renew --quiet
```

---

## 故障排查

### 无法访问

```bash
# 1. 检查服务是否运行
docker compose ps

# 2. 检查端口
sudo netstat -tlnp | grep 3000

# 3. 检查防火墙
sudo ufw status
```

### 数据库连接失败

```bash
# 检查 MySQL 容器
docker compose logs mysql

# 进入 MySQL 容器
docker compose exec mysql mysql -u root -p
```

### 重置管理员密码

```bash
# 进入应用容器
docker compose exec app sh

# 或者直接修改数据库
docker compose exec mysql mysql -u root -p smart_link
# UPDATE users SET passwordHash = '新密码哈希' WHERE username = 'admin';
```

---

## 端口说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 22 | SSH | 远程连接 |
| 80 | Nginx | HTTP |
| 443 | Nginx | HTTPS |
| 3000 | App | Node.js 应用 |
| 3306 | MySQL | 数据库 (内部) |

---

## 部署脚本选项

```powershell
.\deploy\deploy.ps1 -Action <action>

# 可用操作:
#   full    - 完整部署 (首次)
#   update  - 更新代码
#   restart - 重启服务
#   logs    - 查看日志
#   status  - 查看状态
```
