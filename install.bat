@echo off
cd /d "C:\Users\飞牛\.openclaw-autoclaw\workspace\projects\smart-link-manager"
set PATH=C:\Program Files\AutoClaw\resources\node;%PATH%
echo Installing dependencies...
call npm install -g pnpm
call pnpm install --frozen-lockfile
echo Done!
