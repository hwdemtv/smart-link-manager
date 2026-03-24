#!/bin/bash
# Smart Link Manager 部署脚本

set -e

# 配置
SSH_KEY="YOUR_SSH_KEY_PATH"
SERVER="ubuntu@YOUR_SERVER_IP"
PROJECT_DIR="/www/wwwroot/smart-link-manager"

echo "=========================================="
echo " Smart Link Manager 部署脚本"
echo "=========================================="

# 1. 本地提交
echo ""
echo ">>> [1/4] 检查本地代码状态..."
if git diff-index --quiet HEAD --; then
    echo "    没有需要提交的修改"
else
    echo "    发现未提交的修改，请先提交代码："
    echo "    git add ."
    echo "    git commit -m \"your message\""
    exit 1
fi

# 2. 推送到远程
echo ""
echo ">>> [2/4] 推送代码到 GitHub..."
git push origin main

# 3. 服务器更新
echo ""
echo ">>> [3/4] 服务器拉取代码并构建..."
ssh -i "$SSH_KEY" $SERVER << 'ENDSSH'
cd /www/wwwroot/smart-link-manager

echo "    拉取最新代码..."
git pull

echo "    安装依赖..."
pnpm install

echo "    构建项目..."
pnpm build

echo "    重启服务..."
pm2 restart smart-link

echo "    检查服务状态..."
pm2 status
ENDSSH

# 4. 验证部署
echo ""
echo ">>> [4/4] 验证部署..."
sleep 2
curl -s -o /dev/null -w "    HTTP 状态码: %{http_code}\n" http://YOUR_SERVER_IP

echo ""
echo "=========================================="
echo " 部署完成！"
echo " 访问地址: http://YOUR_SERVER_IP"
echo "=========================================="
