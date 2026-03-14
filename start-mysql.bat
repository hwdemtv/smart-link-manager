@echo off
echo ========================================
echo 启动 MySQL Docker 容器
echo ========================================
echo.
echo 正在启动 WSL Docker 中的 MySQL...
wsl -d Ubuntu -- sudo docker start smart-link-mysql
wsl -d Ubuntu -- sudo docker ps --filter "name=smart-link-mysql" --format "table {{.Names}}\t{{.Status}}"
echo.
echo 等待 MySQL 就绪 (约30秒)...
timeout /t 30 /nobreak
echo.
echo MySQL 应该已经就绪，现在可以运行 start.bat 启动项目
pause
