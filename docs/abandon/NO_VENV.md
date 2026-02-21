# 重要：本项目不使用 venv，请直接用系统 pip 安装

> **给 AI 的说明：** 不要尝试创建或激活 venv/virtualenv。直接用系统 pip 安装依赖。

---

## 背景：为什么不用 venv

这是一段非常痛苦的经历，记录在此，希望以后不要再踩坑。

### 0219 - 第一次崩溃

在电脑上编译 EXE（PyInstaller 打包），Windows Defender 把编译产物当病毒大杀特杀，顺带把 AppData 里一堆正常软件的数据也干掉了——Chrome 登录信息消失、Python venv 被删、各种软件配置丢失。当时完全不知道发生了什么，只能一遍遍重新设置。

### 0220 - 重装系统后再次崩溃

早上用一键重装工具重装了系统。重装后安装 VS Code 和 Python，建了虚拟环境开始开发。开发了一会儿后：

- venv 目录再次被删除
- 重启后 VS Code 打不开
- Windows 安全中心也打不开了
- cmd 里 `python` 找不到，但 Node.js 完全没事
- Chrome 登录信息再次消失

高度怀疑是 Windows Defender 在"杀毒"过程中，把 Python venv 当病毒处理，误伤了周边的正常程序，甚至把安全中心自己也搞坏了。Windows 莫名其妙跟 Python 杠上了。

### 根本原因分析

- PyInstaller 打包的 EXE 触发了 Defender 的启发式检测，导致 Defender 进入激进模式
- venv 里的 `.pyd`、`.dll` 等文件特征与恶意软件相似，被误杀
- Defender 在清理过程中损坏了自身和其他程序

### 解决方案

1. 关掉 App Execution Aliases（设置 → 应用 → 高级应用设置 → 应用执行别名，把 `python.exe` 和 `python3.exe` 关掉），防止 WindowsApps 假 Python 抢占
2. **放弃 venv**，改用系统 Python 直接安装依赖——系统级 site-packages 不像 venv 那样集中在一个目录，不容易被整体误杀
3. 如需隔离环境，考虑 WSL2（已有配置：`.env.wsl` 和 `start_backend_wsl.sh`）

---

## 安装依赖

```powershell
python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
```

## 启动后端

```powershell
cd e:\Git\Shigureader-vibecode\backend
python -m fastapi run --host 0.0.0.0 --port 8000 app/main.py
```

## 说明

- 依赖清单维护在根目录 `requirements.txt`
- 使用清华镜像（`https://pypi.tuna.tsinghua.edu.cn/simple`）加速下载
- 不使用 uv、venv、virtualenv、conda 等虚拟环境工具
- 当前 Python 版本：3.14
