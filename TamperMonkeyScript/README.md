# TamperMonkey 脚本开发指南

本目录包含了 `EhentaiHighighliger` 油猴脚本的源代码和构建配置。

## 目录结构

- `src/`: 源代码目录。主要逻辑位于 `src/EhentaiHighighliger.js`。
- `EhentaiHighighliger.user.js`: 构建生成的最终脚本文件（**请勿直接编辑此文件**）。
- `webpack.config.js`: Webpack 配置文件，其中定义了 UserScript 的元数据（如版本号 `@version`、匹配规则 `@include` 等）。
- `package.json`: 项目依赖和脚本命令定义。

## 环境准备

在开始开发前，请确保已安装 Node.js，并在本目录下运行以下命令安装依赖：

```bash
npm install
```

## 开发流程

1. **修改代码**: 在 `src/` 目录下进行代码修改。
2. **修改元数据**: 如果需要更新版本号或修改脚本头部信息，请编辑 `webpack.config.js` 文件中的 `metadata` 变量。
3. **构建脚本**: 运行构建命令生成最终的 `.user.js` 文件。

## 执行命令

本项目提供了以下 npm 脚本命令：

- **构建 (Build)**: 执行一次完整的构建。
  ```bash
  npm run build
  ```

- **开发 (Dev)**: 开启监听模式 (Watch Mode)。文件发生变化时会自动重新构建，适合开发调试。
  ```bash
  npm run dev
  ```

## 更新说明

每次修改功能逻辑后，建议在 `webpack.config.js` 中手动增加 `@version` 版本号，以便用户脚本管理器能够检测到更新。
