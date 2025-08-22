# ShiguReader Server 便携版打包指南 (Webpack版)

本文档面向开发者，指导如何打包一个基于 Webpack 构建的、可供用户使用的便携版 `.zip` 文件。

---

## 重要: 关于打包方式的说明

此打包方法旨在实现**稳定**和**可靠**。

我们将应用自己的源代码 (`src/`) 打包成一个独立的 `build/main.js` 文件，但这**不包括** `node_modules` 里的第三方依赖库。

**为什么？**
像 `sharp` 和 `sqlite3` 这样的库包含原生C++代码（`.node` 文件），它们与操作系统和Node.js版本紧密相关。尝试将这些复杂的原生模块强行打包进一个JS文件非常容易出错且不稳定。

因此，我们采用Node.js社区中最标准、最稳健的做法：**将 `node_modules` 文件夹与我们的代码构建产物一起分发**。这确保了所有依赖项（特别是原生模块）都能在用户的计算机上正确无误地工作。

---

## 打包理念

最终的分发包应包含运行所需的一切，并且对用户来说是开箱即用的。此流程取代了之前所有的打包方式。

- **开发者**负责构建和准备所有依赖。
- **用户**只需解压并运行，无需安装或构建。

---

## 步骤 1: 安装与构建

1.  在您的开发环境中，确保已经运行过 `npm install`，以下载所有依赖项（包括`webpack`）。
2.  运行打包命令：
    ```bash
    npm run build
    ```
3.  此命令会执行 `webpack`，并将您 `src` 目录下的所有应用源代码打包成一个文件：`build/main.js`。

---

## 步骤 2: 准备 Node.js 运行环境

1.  访问 [Node.js 官网下载页面](https://nodejs.org/en/download/).
2.  找到 "Windows Binary (.zip)" 的 64-bit 版本，并下载它。

---

## 步骤 3: 组合最终分发文件

这是最关键的一步。您需要手动将所有需要发布的资源组合到一个干净的文件夹中。

1.  创建一个新的、干净的文件夹，用于存放最终分发的所有文件。例如，可以命名为 `ShiguReader_Server_v3_Distribution`。

2.  **复制以下项目到您的分发文件夹中:**

    | 来源路径 (本项目中)          | 目标路径 (分发文件夹中)            | 说明                                         |
    | ---------------------------- | ---------------------------------- | -------------------------------------------- |
    | `build/`                     | `build/`                           | Webpack构建产物 (核心逻辑)                   |
    | *[Node.js压缩包内容]*         | `node_portable/`                   | 您在步骤2中下载的便携版Node.js运行环境     |
    | `node_modules/`              | `node_modules/`                    | **重要**: 见下面的优化提示                   |
    | `resource/`                  | `resource/`                        | 必要的二进制资源 (7zip, ImageMagick)         |
    | `config-etc.ini`             | `config-etc.ini`                   | 配置文件                                     |
    | `config-path.ini`            | `config-path.ini`                  | 配置文件                                     |
    | `run_server.bat`             | `run_server.bat`                   | 用户的启动脚本                               |
    | `README_dist.md`             | `README.md` 或 `使用指南.md`         | 将用户指南重命名，使其更醒目                 |

3.  **【重要优化】清理 `node_modules`**:
    -   直接复制您开发环境下的`node_modules`会包含大量不必要的开发依赖 (`webpack`, `mocha`等)，导致分发包体积巨大。
    -   **推荐做法**: 在一个临时文件夹中，只安装生产依赖，然后将这个纯净的`node_modules`复制到您的分发文件夹中。
        ```bash
        # 1. 复制 package.json 和 package-lock.json 到一个临时目录
        # 2. 在临时目录中运行:
        npm install --production
        # 3. 这将生成一个只包含生产环境所需模块的 node_modules 文件夹
        ```

---

## 步骤 4: 创建并测试压缩包

1.  将 `ShiguReader_Server_v3_Distribution` 整个文件夹压缩成一个 `.zip` 文件。
2.  **执行最终测试**:
    -   将您创建的 `.zip` 文件在一个干净的环境下解压。
    -   双击 `run_server.bat`。
    -   确认服务器能正常启动，并且您可以通过浏览器访问。
    -   这个步骤至关重要，确保您交付给用户的是一个可用的产品。
