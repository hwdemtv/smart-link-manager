@echo off
cd /d "%~dp0"

echo ========================================
echo Smart Link Manager 启动脚本
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%~dp0node-v22.12.0-win-x64\node.exe" (
        set "PATH=%~dp0node-v22.12.0-win-x64;%PATH%"
        echo 使用便携版 Node.js
    ) else (
        echo [ERROR] 未找到 Node.js！
        echo 请运行 install-node.bat 安装 Node.js
        echo 或手动安装: https://nodejs.org/
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo 使用系统 Node.js !NODE_VER!
)

echo.
echo [1/2] 检查 MySQL 连接...
node -e "const mysql = require('mysql2/promise'); mysql.createConnection({host:'127.0.0.1',port:3306,user:'smartlink',password:'YOUR_DB_PASSWORD',database:'smart_link'}).then(()=>console.log('MySQL 连接成功!')).catch(e=>{console.error('MySQL 连接失败:', e.message);process.exit(1)})"
if errorlevel 1 (
    echo.
    echo 请确保 MySQL 已启动: wsl -d Ubuntu -- sudo docker start smart-link-mysql
    echo 或者运行: wsl -d Ubuntu -- sudo docker compose -f YOUR_DOCKER_COMPOSE_PATH up -d mysql
    pause
    exit /b 1
)

echo.
echo [2/2] 启动开发服务器...
pnpm run dev

pause
