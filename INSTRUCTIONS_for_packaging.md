# ShiguReader Server 便携版打包指南

本文档面向开发者，指导如何打包一个可供用户使用的、纯命令行的便携版 `.zip` 文件。

---

## 打包目标

创建一个包含了所有源代码、资源文件以及便携版Node.js环境的 `.zip` 压缩包。用户下载后，无需安装Node.js即可通过运行批处理脚本来启动服务器。

---

## 步骤 1: 准备 Node.js

1.  访问 [Node.js 官网下载页面](https://nodejs.org/en/download/).
2.  找到 "Windows Binary (.zip)" 的 64-bit 版本，并下载它。
3.  下载后，您会得到一个 `.zip` 文件，例如 `node-v20.11.0-win-x64.zip`。暂时不要解压。

---

## 步骤 2: 准备打包文件夹

1.  在您喜欢的位置，创建一个新的、干净的文件夹，用于存放最终分发的所有文件。例如，可以命名为 `ShiguReader_Server_Distribution`。
2.  将本项目的**所有文件和文件夹**完整地复制到 `ShiguReader_Server_Distribution` 文件夹中。

---

## 步骤 3: 集成便携版 Node.js

1.  在 `ShiguReader_Server_Distribution` 文件夹内，创建一个名为 `node_portable` 的新文件夹。
2.  打开您在步骤1中下载的Node.js的 `.zip` 文件，将其中的所有内容解压到 `node_portable` 文件夹里。
3.  完成后，您的 `node_portable` 文件夹结构应该如下所示：
    ```
    ShiguReader_Server_Distribution/
    └── node_portable/
        ├── node.exe
        ├── npm.cmd
        ├── corepack.cmd
        └── ... (其他文件和文件夹)
    ```

---

## 步骤 4: 清理不必要的文件

为了减小最终压缩包的体积，并避免包含不必要的文件，建议从 `ShiguReader_Server_Distribution` 文件夹中删除以下项目：

**必须删除:**
- `.git/` (如果存在) - Git版本控制历史，体积巨大。
- `node_modules/` (如果存在) - 这是本地开发依赖，用户会通过`setup.bat`重新生成。
- `executables/` (如果存在) - 旧的pkg打包产物。
- `ShiguReader_Backend.exe` (如果存在) - 旧的pkg打包产物。
- `*.log` - 日志文件。

**建议删除 (面向用户的包不需要):**
- `.github/`
- `.vscode/`
- `GUI/` (Python GUI，已不再使用)
- `etc/`
- `reading/`
- `test/`
- `test_samples/`
- `.babelrc`
- `.eslintignore`
- `.eslintrc.json`
- `.flowconfig`
- `.gitignore`
- `INSTRUCTIONS_for_packaging.md` (就是本文件)
- `run.bat` (已被 `run_server.bat` 替代)
- `run_load_balance.bat`

---

## 步骤 5: 创建最终的压缩包

1.  现在，`ShiguReader_Server_Distribution` 文件夹里包含了所有最终用户需要的文件。
2.  将 `ShiguReader_Server_Distribution` 整个文件夹压缩成一个 `.zip` 文件。例如，可以命名为 `ShiguReader_Server_v2.1_portable.zip`。

---

## 步骤 6: 最终测试 (非常重要!)

1.  将您刚刚创建的 `.zip` 文件移动到一个全新的、干净的路径下。
2.  解压缩它。
3.  **完全按照 `README_dist.md` 中的用户指引进行操作**:
    - 双击 `setup.bat` 并等待其完成。
    - 双击 `run_server.bat` 并确认服务器可以正常启动。
4.  只有当您亲自验证过这个流程无误后，才能将这个 `.zip` 文件分发给用户。
