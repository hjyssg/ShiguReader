<div align="center">
  <img src="frontend/public/assets/images/favicon.png" width="100" height="100" alt="ShiguReader Logo" />
  <h1>ShiguReader</h1>
  <div>
    <a href="#ShiguReader">中文</a> |
    <a href="docs/README.en.md">English</a> |
    <a href="docs/README.ja.md">日本語</a> |
    <a href="docs/README.ko.md">한국어</a>
  </div>
  <p>面向本地 / 局域网的内容整理与浏览工具</p>
  <p>「开箱即用、部署简单、适合个人收藏管理」</p>
</div>

---

## 简介

ShiguReader 是一个面向本地 / 局域网的内容整理与浏览工具，目标是「开箱即用、部署简单、适合个人收藏管理」。

### 它能做什么

- **扫描和整理**：快速索引本地内容目录。
- **统一浏览**：提供响应式的网页界面，支持多种内容格式。
- **信息管理**：记录与管理条目信息、阅读历史等。
- **本地化设计**：适合家庭网络 / 小团队内网使用，无需云端依赖。

### 适合谁用

- 想把分散文件集中管理的个人用户。
- 追求极致隐私，不希望内容上传云端的收藏爱好者。
- 希望打包后直接分发给他人运行的场景。

### 运行方式

- **开发模式**：直接通过源码启动。
- **便捷运行**：可打包为 EXE 单文件，双击即用。
- **分发支持**：支持生成分发 ZIP 包。

---

## 开发环境搭建

**前置要求**：安装 [uv](https://docs.astral.sh/uv/getting-started/installation/) 和 [Node.js](https://nodejs.org/)

```bash
# 安装后端依赖
cd backend
uv sync

# 安装前端依赖
cd ../frontend
npm install
```

### 启动（命令行）

打开两个终端分别运行：

```bash
# 终端 1 - 后端
source ./.venv/Scripts/activate
cd backend
uv run fastapi dev app/main.py --host 0.0.0.0 --port 8000

# 终端 2 - 前端
cd frontend
npm run dev
```

### 启动（VS Code）

使用 **Full Stack: Frontend + Backend** 启动配置一键启动。

> **Windows 用户**：建议将项目根目录下的 `.venv` 文件夹加入 Windows Defender 排除列表，避免环境被误删。
> 设置路径：Windows 安全中心 → 病毒和威胁防护 → 管理设置 → 排除项

---

### 相关文档

- [技术文档（环境与实现细节）](docs/TECHNICAL.md)
- [EXE 打包说明](build_tools/BUILD.md)

### 界面预览

<div align="center">
  <img src="img/explorer.png" alt="资源管理器" width="800" />
  <p><em>资源管理器界面</em></p>
  <img src="img/read.png" alt="阅读页" width="800" />
  <p><em>阅读页界面</em></p>
</div>
