@echo off
cd /d "%~dp0"

echo ========================================
echo Smart Link Manager 启动脚本
echo ========================================
echo.

REM 设置 Node.js 路径
set PATH=%~dp0node-v22.12.0-win-x64;%PATH%

echo [1/2] 检查 MySQL 连接...
"%~dp0node-v22.12.0-win-x64\node.exe" -e "const mysql = require('mysql2/promise'); mysql.createConnection({host:'127.0.0.1',port:3306,user:'smartlink',password:'smartlink123',database:'smart_link'}).then(()=>console.log('MySQL 连接成功!')).catch(e=>{console.error('MySQL 连接失败:', e.message);process.exit(1)})"
if errorlevel 1 (
    echo.
    echo 请确保 MySQL 已启动: wsl -d Ubuntu -- sudo docker start smart-link-mysql
    echo 或者运行: wsl -d Ubuntu -- sudo docker compose -f /mnt/c/Users/飞牛/.openclaw-autoclaw/workspace/projects/smart-link-manager/docker-compose.yml up -d mysql
    pause
    exit /b 1
)

echo.
echo [2/2] 启动开发服务器...
"%~dp0node-v22.12.0-win-x64\node.exe" "%~dp0pnpm-pkg\bin\pnpm.cjs" run dev

pause
