#!/bin/bash
# Smart Link Manager 一键部署脚本
# 适用于 Ubuntu 22.04+

set -e # 遇错即停

echo ">>> 正在检查并更新系统基础依赖..."
sudo apt-get update && sudo apt-get install -y curl git ufw

# 1. 检查 Node.js 环境 (如果没装则使用 NodeSource)
if ! command -v node &> /dev/null; then
    echo ">>> 安装 Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo ">>> 安装 pnpm..."
    npm install -g pnpm
fi

# 3. 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo ">>> 安装 PM2..."
    npm install -g pm2
fi

# 4. 切换到项目目录并执行部署
echo ">>> 开始安装项目依赖..."
pnpm install

echo ">>> 构建生产环境产物..."
pnpm run build

echo ">>> 推送数据库 Schema..."
pnpm run db:push

echo ">>> 正在使用 PM2 重启服务..."
pm2 delete slm-server 2>/dev/null || true
pm2 start dist/index.js --name slm-server

echo ">>> 部署完成！正在配置防火墙..."
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp # tRPC 服务端口

echo ">>> 服务状态如下："
pm2 status
