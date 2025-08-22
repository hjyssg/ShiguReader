@echo off
CHCP 65001
cls

echo.
echo =================================================================
echo.
echo                ShiguReader Server
echo.
echo =================================================================
echo.

set "NODE_EXE=%~dp0node_portable\node.exe"
set "SERVER_SCRIPT=%~dp0build\main.js"

rem --- Sanity checks ---
if not exist "%NODE_EXE%" (
    echo 错误: 未在本目录下的 "node_portable" 文件夹中找到 node.exe!
    echo 请确认您下载的软件包是完整的。
    echo.
    pause
    exit /b 1
)

if not exist "%SERVER_SCRIPT%" (
    echo 错误: 未能找到服务器主程序: %SERVER_SCRIPT%
    echo 请确认软件文件完整, 并且开发者已经执行过 build 脚本。
    echo.
    pause
    exit /b 1
)

echo 正在启动服务器...
echo 您可以随时按 Ctrl+C 来关闭服务器。
echo.
echo --- 服务器日志 ---

rem Launch the server and pass all command-line arguments
"%NODE_EXE%" "%SERVER_SCRIPT%" %*

echo.
echo 服务器已停止。
echo.
pause
exit /b 0
