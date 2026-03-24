#!/bin/bash
# Smart Link Manager - 腾讯云部署脚本
# 服务器: YOUR_SERVER_IP
# 用户: ubuntu

set -e

echo "=========================================="
echo "Smart Link Manager 部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为 root 用户
check_user() {
    if [ "$EUID" -eq 0 ]; then
        log_warn "请勿使用 root 用户运行此脚本"
        exit 1
    fi
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    sudo apt-get update -y
    sudo apt-get upgrade -y
}

# 安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker 已安装，跳过..."
        return
    fi

    log_info "安装 Docker..."

    # 安装依赖
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release

    # 添加 Docker 官方 GPG key (使用阿里云镜像)
    curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

    # 添加 Docker 仓库
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # 安装 Docker
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

    # 启动 Docker
    sudo systemctl start docker
    sudo systemctl enable docker

    # 将当前用户添加到 docker 组
    sudo usermod -aG docker $USER

    # 配置 Docker 镜像加速 (腾讯云)
    sudo mkdir -p /etc/docker
    sudo tee /etc/docker/daemon.json <<EOF
{
    "registry-mirrors": [
        "https://mirror.ccs.tencentyun.com"
    ]
}
EOF
    sudo systemctl daemon-reload
    sudo systemctl restart docker

    log_info "Docker 安装完成!"
}

# 安装 Nginx
install_nginx() {
    if command -v nginx &> /dev/null; then
        log_info "Nginx 已安装，跳过..."
        return
    fi

    log_info "安装 Nginx..."
    sudo apt-get install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    log_info "Nginx 安装完成!"
}

# 创建项目目录
setup_project() {
    log_info "创建项目目录..."
    sudo mkdir -p /opt/smart-link-manager
    sudo chown $USER:$USER /opt/smart-link-manager
}

# 创建生产环境配置
create_env_file() {
    log_info "创建环境配置..."

    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -hex 32)

    # 生成数据库密码
    DB_PASSWORD=$(openssl rand -hex 16)

    cat > /opt/smart-link-manager/.env <<EOF
# Database Configuration
DATABASE_URL=mysql://smartlink:${DB_PASSWORD}@mysql:3306/smart_link

# Application Configuration
VITE_APP_ID=http://YOUR_SERVER_IP
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
PORT=3000

# License Server Configuration (可选)
LICENSE_SERVER_URL=

# Default Admin Account
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

# Docker Compose 内部使用
DB_ROOT_PASSWORD=root_$(openssl rand -hex 8)
DB_PASSWORD=${DB_PASSWORD}
EOF

    chmod 600 /opt/smart-link-manager/.env
    log_info "环境配置已创建: /opt/smart-link-manager/.env"
}

# 创建 Docker Compose 配置
create_docker_compose() {
    log_info "创建 Docker Compose 配置..."

    cat > /opt/smart-link-manager/docker-compose.yml <<'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: smart-link-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: smart_link
      MYSQL_USER: smartlink
      MYSQL_PASSWORD: ${DB_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - smart-link-network

  app:
    image: node:22-alpine
    container_name: smart-link-app
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
    working_dir: /app
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://smartlink:${DB_PASSWORD}@mysql:3306/smart_link
      JWT_SECRET: ${JWT_SECRET}
      VITE_APP_ID: ${VITE_APP_ID}
      PORT: 3000
      DEFAULT_ADMIN_USERNAME: ${DEFAULT_ADMIN_USERNAME}
      DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD}
    ports:
      - "3000:3000"
    volumes:
      - ./:/app
    command: sh -c "npm install -g pnpm && pnpm install --frozen-lockfile && pnpm run build && pnpm start"
    networks:
      - smart-link-network

volumes:
  mysql_data:

networks:
  smart-link-network:
    driver: bridge
EOF
}

# 配置 Nginx
configure_nginx() {
    log_info "配置 Nginx..."

    sudo tee /etc/nginx/sites-available/smart-link <<'EOF'
server {
    listen 80;
    server_name YOUR_SERVER_IP;

    client_max_body_size 50M;

    # 主应用
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
    }

    # 短链接跳转
    location ~ ^/s/([a-zA-Z0-9_-]+)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 验证页面
    location /verify/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

    # 启用站点
    sudo ln -sf /etc/nginx/sites-available/smart-link /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default

    # 测试并重载 Nginx
    sudo nginx -t && sudo systemctl reload nginx

    log_info "Nginx 配置完成!"
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."

    sudo apt-get install -y ufw

    # 允许 SSH
    sudo ufw allow 22/tcp

    # 允许 HTTP/HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp

    # 启用防火墙 (非交互模式)
    echo "y" | sudo ufw enable

    log_info "防火墙配置完成!"
}

# 主函数
main() {
    check_user

    echo ""
    echo "开始部署 Smart Link Manager..."
    echo ""

    update_system
    install_docker
    install_nginx
    setup_project
    create_env_file
    create_docker_compose
    configure_nginx
    configure_firewall

    echo ""
    log_info "=========================================="
    log_info "基础环境配置完成!"
    log_info "=========================================="
    echo ""
    echo "后续步骤:"
    echo "1. 上传项目文件到服务器:"
    echo "   scp -r ./smart-link-manager ubuntu@YOUR_SERVER_IP:/opt/"
    echo ""
    echo "2. 登录服务器并启动服务:"
    echo "   ssh ubuntu@YOUR_SERVER_IP"
    echo "   cd /opt/smart-link-manager"
    echo "   docker compose up -d --build"
    echo ""
    echo "3. 查看日志:"
    echo "   docker compose logs -f app"
    echo ""
    echo "默认管理员账号:"
    echo "   用户名: admin"
    echo "   密码: YOUR_ADMIN_PASSWORD"
    echo ""
}

main "$@"
