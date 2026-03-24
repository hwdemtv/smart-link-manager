# Smart Link Manager - 腾讯云部署脚本 (PowerShell)
# 用法: .\deploy.ps1 -Action <full|update|restart|logs|status>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("full", "update", "restart", "logs", "status")]
    [string]$Action = "full"
)

# 服务器配置
$SERVER_IP = "YOUR_SERVER_IP"
$SERVER_USER = "ubuntu"
$SERVER_PASS = "YOUR_SERVER_PASSWORD"
$PROJECT_DIR = "/opt/smart-link-manager"
$LOCAL_DIR = Split-Path -Parent $PSScriptRoot

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Smart Link Manager - 腾讯云部署" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "目标服务器: $SERVER_IP" -ForegroundColor Green
Write-Host "用户名: $SERVER_USER" -ForegroundColor Green
Write-Host ""

function Test-SSHConnection {
    Write-Host "[INFO] 测试 SSH 连接..." -ForegroundColor Yellow
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" "echo OK" 2>&1
    if ($result -ne "OK") {
        Write-Host "[WARN] SSH 密钥未配置，需要手动连接" -ForegroundColor Yellow
        Write-Host "请先运行: ssh $SERVER_USER@$SERVER_IP" -ForegroundColor Yellow
        return $false
    }
    return $true
}

function Deploy-Full {
    Write-Host ""
    Write-Host "[INFO] 开始完整部署..." -ForegroundColor Yellow
    Write-Host ""

    # 1. 上传部署脚本
    Write-Host "[1/5] 上传部署脚本..." -ForegroundColor Yellow
    scp "$PSScriptRoot\deploy.sh" "${SERVER_USER}@${SERVER_IP}:/tmp/deploy.sh"

    # 2. 执行初始化脚本
    Write-Host "[2/5] 执行服务器初始化..." -ForegroundColor Yellow
    ssh "$SERVER_USER@$SERVER_IP" "chmod +x /tmp/deploy.sh && sudo /tmp/deploy.sh"

    # 3. 创建 .env 文件
    Write-Host "[3/5] 创建环境配置..." -ForegroundColor Yellow
    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    $dbPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})

    $envContent = @"
# Database Configuration
DATABASE_URL=mysql://smartlink:${dbPassword}@mysql:3306/smart_link

# Application Configuration
VITE_APP_ID=http://${SERVER_IP}
JWT_SECRET=${jwtSecret}
NODE_ENV=production
PORT=3000

# Default Admin Account
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD

# Docker internal
DB_ROOT_PASSWORD=root_$( -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 8 | ForEach-Object {[char]$_}))
DB_PASSWORD=${dbPassword}
"@

    $envContent | ssh "$SERVER_USER@$SERVER_IP" "cat > $PROJECT_DIR/.env"

    # 4. 上传项目文件
    Write-Host "[4/5] 上传项目文件 (这可能需要几分钟)..." -ForegroundColor Yellow
    Push-Location $LOCAL_DIR

    # 创建排除列表
    $excludeArgs = @(
        "--exclude", "node_modules",
        "--exclude", ".git",
        "--exclude", "dist",
        "--exclude", ".env",
        "--exclude", "*.log"
    )

    # 使用 rsync 如果可用，否则使用 scp
    if (Get-Command rsync -ErrorAction SilentlyContinue) {
        rsync -avz @excludeArgs . "${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/"
    } else {
        # 使用 scp (较慢)
        $filesToUpload = @(
            "package.json", "pnpm-lock.yaml", "Dockerfile", "docker-compose.yml",
            "tsconfig.json", "vite.config.ts", "tailwind.config.ts", "postcss.config.js",
            "drizzle", "server", "client", "patches"
        )
        foreach ($file in $filesToUpload) {
            if (Test-Path $file) {
                scp -r $file "${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/"
            }
        }
    }
    Pop-Location

    # 5. 启动服务
    Write-Host "[5/5] 启动服务..." -ForegroundColor Yellow
    ssh "$SERVER_USER@$SERVER_IP" "cd $PROJECT_DIR && docker compose up -d --build"

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "部署完成!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "访问地址: http://$SERVER_IP" -ForegroundColor Cyan
    Write-Host "默认管理员账号:" -ForegroundColor Yellow
    Write-Host "  用户名: admin" -ForegroundColor Yellow
    Write-Host "  密码: YOUR_ADMIN_PASSWORD" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "查看日志: .\deploy.ps1 -Action logs" -ForegroundColor Gray
}

function Update-Code {
    Write-Host ""
    Write-Host "[INFO] 更新代码..." -ForegroundColor Yellow

    Push-Location $LOCAL_DIR
    $filesToUpload = @("package.json", "pnpm-lock.yaml", "server", "client")

    foreach ($file in $filesToUpload) {
        if (Test-Path $file) {
            scp -r $file "${SERVER_USER}@${SERVER_IP}:${PROJECT_DIR}/"
        }
    }
    Pop-Location

    Write-Host "[INFO] 重启服务..." -ForegroundColor Yellow
    ssh "$SERVER_USER@$SERVER_IP" "cd $PROJECT_DIR && docker compose restart app"

    Write-Host "[SUCCESS] 代码更新完成!" -ForegroundColor Green
}

function Restart-Service {
    Write-Host "[INFO] 重启服务..." -ForegroundColor Yellow
    ssh "$SERVER_USER@$SERVER_IP" "cd $PROJECT_DIR && docker compose restart"
    Write-Host "[SUCCESS] 服务已重启" -ForegroundColor Green
}

function View-Logs {
    Write-Host "[INFO] 查看日志 (Ctrl+C 退出)..." -ForegroundColor Yellow
    ssh "$SERVER_USER@$SERVER_IP" "cd $PROJECT_DIR && docker compose logs -f --tail=100 app"
}

function View-Status {
    Write-Host "[INFO] 服务状态..." -ForegroundColor Yellow
    ssh "$SERVER_USER@$SERVER_IP" "cd $PROJECT_DIR && docker compose ps && echo '' && echo '--- 最近日志 ---' && docker compose logs --tail=20 app"
}

# 主逻辑
switch ($Action) {
    "full" {
        if (-not (Test-SSHConnection)) {
            Write-Host "请先配置 SSH 密钥连接，然后重新运行此脚本" -ForegroundColor Red
            Write-Host ""
            Write-Host "配置步骤:" -ForegroundColor Yellow
            Write-Host "1. 生成密钥: ssh-keygen -t ed25519" -ForegroundColor Gray
            Write-Host "2. 复制公钥: type `$env:USERPROFILE\.ssh\id_ed25519.pub | ssh $SERVER_USER@$SERVER_IP 'cat >> .ssh/authorized_keys'" -ForegroundColor Gray
            exit 1
        }
        Deploy-Full
    }
    "update" { Update-Code }
    "restart" { Restart-Service }
    "logs" { View-Logs }
    "status" { View-Status }
}
