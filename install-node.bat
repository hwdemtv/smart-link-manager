@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Smart Link Manager - Node.js 安装脚本
echo ========================================
echo.

REM 检查是否已安装 Node.js
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo [OK] 已检测到 Node.js !NODE_VERSION!
    echo.
    goto :check_pnpm
)

echo [!] 未检测到 Node.js，正在准备安装...
echo.

REM 检测系统架构
if "%PROCESSOR_ARCHITECTURE%"=="AMD64" (
    set ARCH=x64
) else (
    set ARCH=x86
)

REM Node.js 版本
set NODE_VERSION=22.12.0
set NODE_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-%ARCH%.zip
set NODE_ZIP=%TEMP%\node.zip
set NODE_DIR=%~dp0node-v%NODE_VERSION%-win-%ARCH%

echo 正在下载 Node.js v%NODE_VERSION% (%ARCH%)...
echo URL: %NODE_URL%
echo.

REM 使用 PowerShell 下载
powershell -Command "Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_ZIP%' -UseBasicParsing"
if %errorlevel% neq 0 (
    echo [ERROR] 下载失败！请手动下载并安装 Node.js:
    echo https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo 正在解压...
powershell -Command "Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%~dp0' -Force"
if %errorlevel% neq 0 (
    echo [ERROR] 解压失败！
    pause
    exit /b 1
)

REM 清理
del "%NODE_ZIP%" 2>nul

echo.
echo [OK] Node.js 安装完成！
echo 位置: %NODE_DIR%

:check_pnpm
echo.
echo 检查 pnpm...
where pnpm >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('pnpm -v') do set PNPM_VERSION=%%i
    echo [OK] 已检测到 pnpm v!PNPM_VERSION!
    goto :install_deps
)

echo [!] 未检测到 pnpm，正在安装...
npm install -g pnpm
if %errorlevel% neq 0 (
    echo [ERROR] pnpm 安装失败！
    pause
    exit /b 1
)

echo [OK] pnpm 安装完成！

:install_deps
echo.
echo ========================================
echo 安装项目依赖...
echo ========================================
cd /d "%~dp0"

REM 检查是否有便携版 Node.js
if exist "%~dp0node-v22.12.0-win-x64\node.exe" (
    set "PATH=%~dp0node-v22.12.0-win-x64;%PATH%"
    echo 使用便携版 Node.js
) else if exist "%~dp0node-v22.12.0-win-x64\node.exe" (
    set "PATH=%~dp0node-v22.12.0-win-x64;%PATH%"
    echo 使用便携版 Node.js
) else (
    echo 使用系统 Node.js
)

pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] 依赖安装失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo 安装完成！
echo ========================================
echo.
echo 运行 start.bat 启动项目
echo.
pause
