# EXE 打包与运行调试记录（可中断续跑）

## 目标
- 打包成 `dist/ShiguReader.exe`
- EXE 启动后自动拉起后端并打开前端页面（`http://127.0.0.1:8000`）
- 同步更新 `launch.json` / build 脚本 / README

## 当前进度（2026-02-15）
- [x] 定位现有脚本：`build_tools/build_exe.py`、`build_tools/launch.py`
- [x] 复现旧版 EXE 启动失败（配置必填导致崩溃）
- [x] 修复配置加载：支持 exe 同目录 `.env`，并提供默认值兜底
- [x] 新增 `build_tools/exe_launcher.py` 作为 EXE 入口（启动 uvicorn + 自动打开浏览器）
- [x] 调整 `build_tools/build_exe.py`，改为打包 `exe_launcher.py`
- [x] 重新打包并验证 EXE 可用
- [x] 更新 VSCode 调试/任务配置与文档

## 验证结果
- `python build_tools/build_exe.py` 成功，产物：`dist/ShiguReader.exe`（约 32.3 MB）
- 运行 `./dist/ShiguReader.exe` 后日志显示：
  - 成功启动 uvicorn（`http://127.0.0.1:8000`）
  - 自动打开浏览器到首页
  - 前端静态资源 `assets/*.js/css` 返回 200
  - 前端接口请求 `/api/v1/fs/*` 返回 200

## 追加修复（CORS）
- 问题：EXE 页面来源为 `http://127.0.0.1:8000`，但前端 API 指向 `http://localhost:8000`，导致跨源。
- 修复：`frontend/src/main.tsx` 中 API 基地址改为“同源优先”策略：
  - 当页面运行在 `:8000`（EXE 托管场景）时，强制使用 `window.location.origin`
  - 其他场景仍兼容 `VITE_API_URL` 配置
- 文档补充：`dist` 为最终交付目录；`.env` 不自动生成，需手动复制 `.env.example` 到 `dist/.env`（如需自定义配置）。

## 二次验证（2026-02-15）
- 额外修复：`frontend/src/hooks/useFileOperations.ts` 从 `axios.create({ baseURL: OpenAPI.BASE })` 改为相对路径请求，彻底消除模块初始化阶段的跨源隐患。
- 重新执行 `python build_tools/build_exe.py` 打包成功（32.3 MB）。
- 重新运行 `./dist/ShiguReader.exe`：`/api/v1/fs/favorite|already-read|roots|drives` 均返回 200。
- 若浏览器仍偶发请求旧版哈希 JS（404），执行一次硬刷新（Ctrl+F5）即可。

## 三次修复与验证（2026-02-15）
- 修复了 EXE 深链 404 根因：
  - 在 `backend/app/main.py` 增加 SPA fallback 路由 `/{full_path:path}`，对 `/read`、`/video`、`/explorer` 等前端路由统一回退 `index.html`。
  - 同时修复 `custom_generate_unique_id`：当路由无 tags（fallback 路由）时不再抛 `IndexError`。
- 改进了 EXE 启动可见性：
  - `build_tools/exe_launcher.py` 增加端口占用检测；若 `8000` 已有实例则提示并仅打开浏览器，不再“黑窗一闪就退”。
  - 保留控制台前台日志，方便观察服务器状态（启动、请求、报错）。
- 关键回归验证（程序内测试）：
  - `/read?...` -> 200 + `text/html`
  - `/video?...` -> 200 + `text/html`
  - `/explorer?...` -> 200 + `text/html`

### 当前已确认
- EXE 启动后可看到持续日志，非静默后台进程。
- 前端深链路由不再应由后端直接返回 404。

### 如再次遇到 404（快速排查）
1. 先确认是否运行的是最新 `dist/ShiguReader.exe`（重新打包后再启动）。
2. 确认没有旧实例占用 `8000`：
   - `netstat -ano | findstr :8000`
3. 浏览器执行硬刷新（Ctrl+F5）清除旧哈希资源缓存。
4. 若仍异常，保留 EXE 控制台日志并继续记录到本文件。

## 已知问题
- `frontend` 的 TypeScript 全量检查存在历史报错，原 `npm run build` 会失败。
- EXE 打包现已改为优先 `build:exe`，否则回退 `npx vite build`，避免被 TS 历史错误阻断。

## 下一步
1. 执行 `python build_tools/build_exe.py`
2. 运行 `dist/ShiguReader.exe`
3. 验证 `/read`、`/video`、`/explorer` 深链打开不再 404
4. 评估是否引入桌面 UI 套壳（PySide6/Tauri）
