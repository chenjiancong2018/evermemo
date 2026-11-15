@echo off
chcp 65001 >nul
setlocal
cd /d D:\dsh\evermemo

echo ==========================================
echo   Evermemo 一键启动
echo ==========================================
echo.

netstat -ano | findstr ":4321 " | findstr "LISTENING" >nul
if errorlevel 1 (
  echo [1/2] 启动网站服务 ...
  start "Evermemo Server" /min "C:\Users\Lenovo\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" "D:\dsh\evermemo\node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 4321
  timeout /t 4 >nul
) else (
  echo [1/2] 网站服务已在运行，跳过。
)

echo [2/2] 启动公网隧道（窗口里会显示 https 网址，等它出现后复制给手机用）...
echo.
start "Evermemo Tunnel" cmd /k ""C:\Users\Lenovo\AppData\Local\Programs\cloudflared\cloudflared.exe" tunnel --url http://localhost:4321"

echo.
echo 本机访问：http://localhost:4321
echo 局域网访问：http://10.215.169.31:4321
echo 公网网址：见「Evermemo Tunnel」窗口里的 https:// 地址
echo.
pause
