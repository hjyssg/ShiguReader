# ShiguReader

基于 `fastapi/full-stack-fastapi-template` 初始化，并按 **LAN 内网最小化部署** 做了裁剪。

## 当前保留

- FastAPI + SQLModel + SQLite
- React + Vite 前端
- 基础用户/条目管理结构

## 已移除 / 禁用

- Docker Compose（开发/生产）
- Traefik 相关配置
- JWT 鉴权流程
- 邮件找回密码流程
- Mailcatcher
- Docker Compose + Traefik 部署文档

## 快速启动

### 方式 1：一键启动脚本（推荐）

```bash
python build_tools/launch.py
```

这会自动启动前后端并打开浏览器。

### 方式 2：手动启动

#### 后端

```bash
cd backend
uv sync
uv run fastapi dev app/main.py
```

后端地址：<http://localhost:8000>

接口文档：<http://localhost:8000/docs>

#### 前端

```bash
cd frontend
npm install
npm run dev
```

前端地址：<http://localhost:5173>

## 打包成 EXE

详见 [build_tools/BUILD.md](build_tools/BUILD.md)

```bash
python build_tools/build_exe.py
```

运行：

```bash
./dist/ShiguReader.exe
```

EXE 会自动启动后端并托管前端，同时自动打开浏览器到 `http://127.0.0.1:8000`。

## 一键打包分发 ZIP（推荐给别人直接运行）

```bash
python build_tools/package_dist.py
```

该命令会自动：
1. 执行 EXE 打包（等价 `python build_tools/build_exe.py`）
2. 将整个 `dist/` 目录打成 zip，输出到 `release/`
3. **自动排除 `dist/data` 的真实内容**（防止测试数据泄露），仅保留空目录结构

示例产物：
- `release/ShiguReader-dist-20260215-180000.zip`

对外分发时，直接把这个 ZIP 发给别人，解压后运行 `ShiguReader.exe` 即可。

## 说明

- 本分支面向内网使用，认证已按你的要求禁用。
- 生产公网场景请不要直接使用当前安全策略。