我需要你先开发后端的核心业务逻辑模块

基于 TDD 模式的 Python 综合文件处理模块开发任务
核心开发规约：
测试驱动开发 (TDD)： 必须严格遵循“先写单元测试 (UT)，再写功能实现”的流程。
模块化解耦： 每个功能必须独立存放在单独的文件夹中，拥有独立的入口和测试套件。
自动化测试环境： 脚本需具备“自给自足”能力，即自动从网络下载样本图片，并动态生成测试所需的各类压缩包（ZIP, RAR, 7Z, TAR）。
待开发功能清单：
1. 多格式存档列表 (List Archive)
功能： 读取并列出压缩文件内的完整条目清单。
支持格式： .zip, .rar, .7z, .tar（包含 .tar.gz, .tar.bz2 等）。
2. 分步定向解压 (Stepwise Extraction)
功能： 实现一种两段式的解压逻辑。
逻辑流程：
优先解压： 根据指定的文件名或规则，先解压压缩包内的特定几个文件。
余项解压： 在特定文件解压完成后，再触发解压包内剩余的所有内容。
要求： 需确保解压过程的原子性，支持上述所有压缩格式。
3. 首图缩略图提取 (Thumbnail Generation)
功能： 从压缩包中检索并仅解压出“第一张”图片文件。
处理： 将该图片处理为高度固定为 350px 的缩略图（需保持原始宽高比）。
4. 文件夹全时监控 (Folder Watcher)
功能： 对指定目录进行实时监听。
监听事件： 捕获并记录文件或文件夹的 CRUD（创建 Create、读取/打开 Read、更新/修改 Update、删除 Delete）行为。

💡 给开发者的技术建议（可选）：
压缩库： 建议使用 patool 作为通用后端，或者分别使用 zipfile, tarfile, rarfile, py7zr 以获得更精细的控制。
图像处理： 推荐使用 Pillow 处理缩略图。
监听工具： 推荐使用 watchdog 库。
测试框架： 建议统一使用 pytest。

同时unit test需要测试性能，保证性能不能太差。
你自行安装依赖、编写代码，进行测试，git操作。全部结束了输出报告给我

-------------------
我之前用另一个ai实验了，它的笔记：

下面是图片中的 OCR 文字整理版（已按结构排版）：

---

# AI 开发指南：Python 综合文件处理模块

## 🎯 任务概述

基于 TDD 模式开发 4 个文件处理功能模块。

---

## 📦 必装依赖

```bash
pip install pytest pytest-benchmark pytest-cov py7zr Pillow watchdog requests
```

---

## ⚠ 关键避坑指南

### 1. py7zr 库的坑

**问题：** `szf.read(targets=[...])` 方法在某些版本返回空或行为不一致。

**解决方案：** 使用 `extract` 方法配合临时目录：

```python
import tempfile

with tempfile.TemporaryDirectory() as tmpdir:
    with py7zr.SevenZipFile(archive_path, 'r') as szf:
        szf.extract(path=tmpdir, targets=[filename])
    # 从 tmpdir 读取文件
```

---

### 2. watchdog 文件监控测试不稳定

**问题：** 事件触发有延迟，测试可能随机失败。

**解决方案：**

* 每个测试用 `uuid` 生成唯一目录名
* 启动监控后等待 0.5–1 秒
* 操作后等待 1–1.5 秒再验证
* 性能测试放宽断言（如 >=80% 事件捕获）

---

### 3. 测试数据自动生成

**建议：** 创建 `TestDataGenerator` 类：

* 从网络下载样本图片（picsum.photos）
* 动态生成各格式压缩包
* 使用 `conftest.py` 的 `@pytest.fixture(scope="session")` 缓存

---

### 4. conftest.py 配置

```python
import pytest
from pathlib import Path

@pytest.fixture(scope="session")
def test_data_dir():
    """全局测试数据目录"""
    base_dir = Path(__file__).parent / "test_data"
    base_dir.mkdir(exist_ok=True)
    return str(base_dir)
```

---

## 📁 推荐项目结构

```
project/
├── conftest.py                # pytest fixtures
├── utils/
│   └── test_data_generator.py # 测试数据生成
├── archive_lister/            # 功能1
│   ├── lister.py
│   └── test_lister.py
├── stepwise_extractor/        # 功能2
├── thumbnail_generator/       # 功能3
├── folder_watcher/            # 功能4
```

---

## 🔧 TDD 开发流程

1. **Red：** 先写测试（包含性能测试）
2. **Green：** 实现最小功能通过测试
3. **Refactor：** 优化代码

---

## 📊 性能测试要点

```python
def test_performance(self, benchmark):
    result = benchmark(self.func, *args)
    assert result is not None

def test_under_time_limit(self):
    start = time.time()
    # 操作
    assert time.time() - start < 2.0  # 2秒内完成
```

---

## 🚀 快速开发顺序

1. `utils/test_data_generator.py` — 先搞定测试数据
2. `archive_lister` — 最简单，熟悉压缩库
3. `stepwise_extractor` — 复用 lister 逻辑
4. `thumbnail_generator` — 加入 Pillow
5. `folder_watcher` — 独立模块，最后做

---

## 💡 其他建议

* 不要提交 `test_data/` 目录，用 `.gitignore` 忽略
* 每个模块独立 `__init__.py` 导出主类
* 压缩包格式检测用文件后缀，不要用 magic number

--
