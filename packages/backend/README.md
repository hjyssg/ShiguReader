# ShiguReader Backend (后端分支)

> **注意：** 本分支仅供开发人员使用。

## 开发流程

为了确保前后端协作顺畅，请遵循以下开发逻辑：

1. **前端初始化**：在前端目录下运行 `npm i`。
2. **资源同步**：运行 `etc\sync_frontend_assets_to_backend.py`。
* 该脚本会自动执行 `npm run build`。
* 将生成的 `dist` 文件夹同步至后端目录（若不执行此步，后端将缺少静态页面文件）。


3. **开发环境联调**：
* **前端**：使用 Webpack Dev Server（例如端口 `9000`）。
* **后端**：使用 VS Code 打开项目，运行 `main server`（例如端口 `3000`）。
* **转发机制**：用户访问 `localhost:9000`，所有的 API 请求会自动转发到 `3000` 端口的后端服务。


---

## 发布流程

项目使用 [yao-pkg](https://github.com/yao-pkg/pkg) 进行打包：

1. **环境准备**：确保已安装 `pkg` 工具。
2. **生成执行文件**：
```bash
pkg . --compress GZip

```


3. **打包资源**：
* 确认前端 Webpack 已完成打包。
* 运行 `pkg_zip_tool.py` 将程序及相关依赖打包成 `.zip`。


4. **安全检查**：**打包前请务必检查并清除个人敏感信息。**
5. **参考资料**：更多细节请查阅 `pkg_readme`。

---

## ⌨️ 命令行参数

启动 `ShiguReader.exe` 时支持以下参数：

| 参数 | 说明 | 示例 |
| --- | --- | --- |
| `--port` | 设置软件监听的端口号 | `ShiguReader.exe --port=3000` |
| `--skip-scan` | 跳过启动时的自动扫描过程，加快启动速度 | `ShiguReader.exe --skip-scan` |

---

## 📦 数据迁移方法

如果您需要从旧项目迁移数据，请手动复制以下路径的文件至新后端目录下：

* `thumbnails/` (缩略图文件夹)
* `workspace/shigureader_internal_db.sqlite` (SQLite 数据库文件)

