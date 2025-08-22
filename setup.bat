@echo off
CHCP 65001
cls

echo.
echo =================================================================
echo.
echo                ShiguReader Server 首次安装程序
echo.
echo =================================================================
echo.
echo 本脚本将自动安装 ShiguReader 所需的依赖项。
echo 这个过程可能需要几分钟，请保持网络连接通畅。
echo.
echo 按任意键开始安装...
pause > nul
cls

set "NODE_DIR=%~dp0node_portable"

echo.
echo 正在检查 Node.js 环境...
if not exist "%NODE_DIR%\node.exe" (
    echo.
    echo 错误：未在本目录下的 "node_portable" 文件夹中找到 node.exe!
    echo 请确认您下载的软件包是完整的。
    echo.
    pause
    exit /b 1
)
echo Node.js 环境检查通过。
echo.

echo.
echo 正在使用内置的 Node.js 安装依赖库 (npm install)...
echo 这可能会花费 5-10 分钟，请耐心等待...
echo.

rem Run npm install using the portable node
"%NODE_DIR%\npm.cmd" install

if %ERRORLEVEL% neq 0 (
    echo.
    echo =================================================================
    echo.
    echo :( 安装失败!
    echo.
    echo =================================================================
    echo.
    echo 依赖项安装过程中发生错误。
    echo 请检查上面的错误信息。最常见的原因是网络问题。
    echo 您可以关闭本窗口，然后尝试重新运行 setup.bat。
    echo.
    pause
    exit /b 1
)

cls
echo.
echo =================================================================
echo.
echo :) 安装成功!
echo.
echo =================================================================
echo.
echo 所有依赖项均已成功安装。
echo.
echo 您现在可以关闭本窗口，然后双击运行 run_server.bat 来启动服务器了。
echo.
pause
exit /b 0
