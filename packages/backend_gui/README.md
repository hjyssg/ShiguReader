# ShiguReader Backend GUI

跨平台 Electron 应用，用于可视化地启动、停止和监控现有的 `packages/backend/src/app.js` 服务。提供配置表单、状态监控、日志查看和异常处理，让非技术同学也能轻松操作。应用采用 Electron (主进程) + React/Tailwind (渲染进程) 架构，并支持 `electron-builder` 打包 Windows、macOS 与 Linux 安装包。

## 目录结构

```
packages/backend_gui/
├── electron/             # 主进程源码（TypeScript）
│   ├── config.ts         # 配置读写逻辑（含 .env 默认值）
│   ├── logWriter.ts      # 日志写入与滚动
│   ├── main.ts           # Electron 入口、IPC 处理
│   └── serviceManager.ts # Node 服务生命周期管理
├── preload.ts            # 预加载脚本，暴露安全 IPC API
├── renderer/             # React + Tailwind 前端界面
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── pages/App.tsx # UI 主页面
│       └── types.ts
├── scripts/
│   └── smoke-test.js     # 简易 E2E 冒烟脚本
├── electron-builder.yml  # 打包配置
├── package.json          # Electron 应用配置
└── tsconfig*.json
```

## 运行步骤

> 推荐使用 Node.js 18+，并确保仓库根目录已安装依赖（`npm install`）。

1. 安装依赖

   ```bash
   cd packages/backend_gui
   npm install
   ```

   安装过程中会自动在 `renderer/` 目录执行一次 `npm install`。

2. 启动开发环境

   ```bash
   npm run dev
   ```

   - `renderer` 使用 Vite 在 `http://localhost:5173` 提供热重载。
   - `electron/main.ts` 通过 `ts-node-dev` 运行，自动重启。
   - UI 中可立即连接并控制 `packages/backend/src/app.js`。

3. 生产构建

   ```bash
   npm run build        # 编译主进程 + 渲染进程
   npm exec electron-builder -- --config electron-builder.yml
   ```

   生成安装包：

   - Windows：`dist/ShiguReader Backend Console Setup.exe`（NSIS）
   - macOS：`dist/ShiguReader-Backend-Console.dmg`
   - Linux：`dist/ShiguReader-Backend-Console.AppImage`

   > 默认图标文件位于 `electron/icons/`，目前提供占位逻辑，可根据品牌要求替换 `app.png` 与 `trayTemplate.png`。

## 功能速览

- **启动前配置**：支持端口、日志级别、崩溃自动重启开关，允许恢复默认。
- **服务控制**：点击启动/停止；状态灯（绿/黄/灰）；显示 PID、端口、运行时长（hh:mm:ss）。
- **日志面板**：实时读取 `stdout/stderr`，按级别着色，可过滤关键字、级别，支持清屏与复制全部。
- **日志落盘**：写入 `userData/logs/YYYY-MM-DD.log`，单文件最大 10 MB，保留 10 个文件。
- **异常处理**：捕获启动失败（端口占用、权限不足、Node 环境缺失等）并给出解决建议。
- **端口冲突处理**：检测占用，推荐 +1/+10/+100 可用端口，支持“一键套用并重试”。
- **健康检查**：后台定时访问 `/health`，UI 徽章同步健康/异常状态。
- **崩溃自动重启**：可选开关，最多尝试三次并在日志中提醒。
- **系统托盘**：托盘菜单支持打开主窗、启动/停止服务以及退出。

## 与现有后端联动

- 默认假设后端入口位于仓库 `packages/backend/src/app.js`，并且导出标准 Express 服务。
- 若后端依赖 `.env`，将其放在 `packages/backend/.env`，GUI 会读取其中的 `PORT`、`LOG_LEVEL` 作为初始值。
- 可在 UI 中修改端口、日志等级，最终以 GUI 配置为准（写入 Electron `userData/config.json`）。

## 常见问题排查

| 现象 | 可能原因 | 建议处理 |
| ---- | -------- | -------- |
| 启动失败并提示 `ENOENT` | 系统缺少 Node.js 或 `backend` 路径错误 | 安装 Node.js 18+，确认 `packages/backend/src/app.js` 存在 |
| 端口占用 | 其他程序占用相同端口 | 通过提示按钮一键切换推荐端口后重试 |
| 日志为空 | 后端未输出或被过滤 | 确认日志级别、关键字过滤是否正确 |
| 健康状态持续异常 | `/health` 接口异常或网络被拦截 | 直接访问 `http://127.0.0.1:PORT/health` 检查返回 |
| 自动重启超过 3 次仍失败 | 后端代码异常 | 关闭自动重启，查看日志定位问题 |

## 冒烟测试脚本

`scripts/smoke-test.js` 用于验证“启动 → 健康检查 → 停止”流程：

```bash
cd packages/backend_gui
node scripts/smoke-test.js
```

脚本会在端口 `3100` 启动后端，访问 `/health`，最后发送 `SIGINT` 并在 5 秒内强制退出。

## 下一步

- 替换品牌化图标、应用名称。
- 根据需要扩展更多配置项（例如数据目录、代理设置）。
- 可引入自动更新（如 Squirrel / electron-updater）以提升发版体验。
