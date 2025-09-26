# 使用说明

## 下载并运行

1. 前往 [Release](https://github.com/hjyssg/ShiguReader/releases) 下载最新版本。
2. 解压缩后运行 `ShiguReader_Backend.exe`（或适用于你平台的可执行文件）。
3. 请修改同目录下的 `config-path.ini` 与 `config-etc.ini` 以满足你的环境需求。

## 开发模式

1. 在项目目录执行 `npm i` 安装依赖。
2. 之后通过 `npm run start` 启动，或双击仓库中提供的一键 `.bat` 脚本。

## 与 Everything 集成进行快速扫描

ShiguReader 可以借助 [Everything](https://www.voidtools.com/) 的索引能力，在不额外扫描整个硬盘的情况下快速检索本地文件：

1. 在 Windows 上安装 Everything，并在 `工具 → 选项 → HTTP 服务器` 中启用 HTTP 服务（或安装 Everything Server 插件），设置监听端口，例如 `8888`。
2. 确保 Everything 已完成对目标磁盘的索引；之后它会持续监控文件系统变更，无需再额外等待全盘扫描。
3. 打开 `packages/backend/config-etc.ini`，在 `everything_http_server_port` 后填入上一步配置的端口号，例如：

   ```ini
   everything_http_server_port = 8888
   ```

4. 重启 ShiguReader 后，后端会通过 Everything 提供的索引数据加速检索，实现在短时间内返回搜索结果。

> 提示：如果 Everything HTTP 服务部署在其它主机，请同时在同一配置文件中调整后端访问地址，确保网络可达。

