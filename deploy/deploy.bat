@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==========================================
echo Smart Link Manager - 腾讯云部署
echo ==========================================
echo.

:: 服务器配置
set SERVER_IP=YOUR_SERVER_IP
set SERVER_USER=ubuntu
set SERVER_PASS=YOUR_SERVER_PASSWORD
set PROJECT_DIR=/opt/smart-link-manager

:: 检查 pscp 是否存在 (PuTTY 工具)
where pscp >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] pscp 未找到，使用 scp...
    set USE_SCP=1
) else (
    set USE_SCP=0
)

:: 检查 plink 是否存在
where plink >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] plink 未找到，使用 ssh...
    set USE_PLINK=0
) else (
    set USE_PLINK=1
)

echo [INFO] 目标服务器: %SERVER_IP%
echo [INFO] 用户名: %SERVER_USER%
echo.

:: 选项菜单
echo 请选择操作:
echo [1] 完整部署 (首次部署)
echo [2] 仅上传代码 (更新代码)
echo [3] 重启服务
echo [4] 查看日志
echo [5] 查看服务状态
echo [6] 退出
echo.

set /p choice="请输入选项 (1-6): "

if "%choice%"=="1" goto full_deploy
if "%choice%"=="2" goto upload_code
if "%choice%"=="3" goto restart_service
if "%choice%"=="4" goto view_logs
if "%choice%"=="5" goto view_status
if "%choice%"=="6" goto end

echo [ERROR] 无效选项
goto end

:full_deploy
echo.
echo [INFO] 开始完整部署...
echo.

:: 检查是否安装了必要工具
where ssh >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] ssh 命令未找到，请安装 OpenSSH 或 Git Bash
    goto end
)

:: 上传部署脚本
echo [1/4] 上传部署脚本...
scp deploy\deploy.sh %SERVER_USER%@%SERVER_IP%:/tmp/deploy.sh

:: 执行部署脚本
echo [2/4] 执行服务器初始化脚本...
ssh %SERVER_USER%@%SERVER_IP% "chmod +x /tmp/deploy.sh && sudo /tmp/deploy.sh"

:: 上传项目文件
echo [3/4] 上传项目文件...
scp -r -o "ConnectTimeout=30" ^
    --exclude "node_modules" ^
    --exclude ".git" ^
    --exclude "dist" ^
    --exclude ".env" ^
    ./* %SERVER_USER%@%SERVER_IP%:%PROJECT_DIR%/

:: 启动服务
echo [4/4] 启动服务...
ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose up -d --build"

echo.
echo [SUCCESS] 部署完成!
echo 访问地址: http://%SERVER_IP%
goto end

:upload_code
echo.
echo [INFO] 上传代码...
echo.

:: 使用 rsync 或 scp
where rsync >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] 使用 rsync 上传...
    rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' ./ %SERVER_USER%@%SERVER_IP%:%PROJECT_DIR%/
) else (
    echo [INFO] 使用 scp 上传...
    scp -r *.json *.ts *.js src server client drizzle deploy Dockerfile docker-compose.yml %SERVER_USER%@%SERVER_IP%:%PROJECT_DIR%/
)

echo [INFO] 重启服务...
ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose restart app"

echo.
echo [SUCCESS] 代码更新完成!
goto end

:restart_service
echo.
echo [INFO] 重启服务...
ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose restart"
echo [SUCCESS] 服务已重启
goto end

:view_logs
echo.
echo [INFO] 查看日志 (Ctrl+C 退出)...
ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs -f --tail=100 app"
goto end

:view_status
echo.
echo [INFO] 服务状态...
ssh %SERVER_USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps && echo. && echo '--- 容器日志 (最后20行) ---' && docker compose logs --tail=20"
goto end

:end
echo.
pause
