# Smart Link Manager 部署脚本 (Windows PowerShell)

$SSH_KEY = "D:\Users\hwdem\Downloads\PC.pem"
$SERVER = "ubuntu@43.156.55.3"
$PROJECT_DIR = "/www/wwwroot/smart-link-manager"

Write-Host "=========================================="
Write-Host " Smart Link Manager 部署脚本"
Write-Host "=========================================="

# 检查是否有未提交的修改
$hasChanges = git status --porcelain
if ($hasChanges) {
    Write-Host ""
    Write-Host "发现未提交的修改:" -ForegroundColor Yellow
    Write-Host "  请先提交代码:"
    Write-Host "  git add ."
    Write-Host "  git commit -m `"your message`""
    Write-Host "  .\deploy.ps1"
    exit 1
}

# 推送代码
Write-Host ""
Write-Host ">>> [1/2] 推送代码到 GitHub..." -ForegroundColor Cyan
git push origin main

# 服务器部署
Write-Host ""
Write-Host ">>> [2/2] 服务器部署..." -ForegroundColor Cyan
ssh -i $SSH_KEY $SERVER "cd $PROJECT_DIR && git pull && pnpm install && pnpm build && pm2 restart smart-link && pm2 status"

# 验证
Write-Host ""
Write-Host "验证部署..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $response = Invoke-WebRequest -Uri "http://43.156.55.3" -TimeoutSec 10 -UseBasicParsing
    Write-Host "HTTP 状态码: $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "警告: 无法访问服务" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=========================================="
Write-Host " 部署完成！" -ForegroundColor Green
Write-Host " 访问地址: http://43.156.55.3"
Write-Host "=========================================="
