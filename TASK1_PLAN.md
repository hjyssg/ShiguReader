# Task1 实施计划：Zip 内大图压缩与再打包

## 📋 需求确认

- ✅ 压缩格式：强制转换为 JPEG
- ✅ 验证失败处理：输出文件名添加 `.error` 后缀
- ✅ 进度反馈：代码中添加注释，预留后续实现接口
- ✅ 支持格式：仅 zip（参考旧版）

## 🎯 核心功能

### 1. 图片压缩逻辑
- 扫描 zip 内所有图片文件
- 判断是否需要压缩：
  - 文件大小 >= 1MB
  - 分辨率 > 2000x2000
- 压缩策略：
  - 转换为 JPEG 格式
  - 保持宽高比缩放
  - 质量设置：85
  - 保留 EXIF 信息

### 2. 压缩包验证
- 独立验证模块：`validator.py`
- 验证项：
  1. 文件数量一致
  2. 目录结构一致
  3. 文件名列表一致
  4. 非图片文件内容完全相同（字节级）
  5. 图片文件可正常打开（未损坏）
- 验证失败：输出文件名添加 `.error` 后缀

### 3. 输出位置
- 原文件夹：默认行为
- 指定目录：可选参数

## 📁 模块结构

```
backend/app/file_processing/archive_compressor/
├── __init__.py
├── service.py          # 核心压缩逻辑
├── validator.py        # 压缩包验证（独立模块）
└── config.py           # 压缩配置
```

## 🔧 配置项

在 `backend/app/core/config.py` 添加：

```python
# 图片压缩配置
IMAGE_COMPRESS_MAX_WIDTH: int = 2000
IMAGE_COMPRESS_MAX_HEIGHT: int = 2000
IMAGE_COMPRESS_MIN_SIZE: int = 1048576  # 1MB
IMAGE_COMPRESS_QUALITY: int = 85
IMAGE_COMPRESS_FORMAT: str = "JPEG"
```

## 🌐 API 端点

```python
POST /api/v1/fs/archive/compress-images
参数：
  - archive_path: str (必需)
  - output_path: str | None (可选，默认原文件夹)
  - max_width: int | None (可选，覆盖配置)
  - max_height: int | None (可选，覆盖配置)
  - quality: int | None (可选，覆盖配置)

返回：CompressResponse
  - status: "ok" | "error"
  - message: str
  - original_path: str
  - output_path: str
  - original_size: int
  - compressed_size: int
  - compression_ratio: float
  - processed_images: int
  - skipped_images: int
  - validation_passed: bool
```

## 🧪 测试用例

### validator 测试（独立）
`backend/tests/file_processing/archive_compressor/test_validator.py`

1. ✅ test_compare_identical_archives - 相同压缩包
2. ✅ test_compare_missing_file - 文件缺失
3. ✅ test_compare_different_content - 内容不同
4. ✅ test_compare_corrupted_image - 损坏图片检测
5. ✅ test_compare_different_structure - 目录结构不同

### compressor 测试
`backend/tests/file_processing/archive_compressor/test_compressor.py`

1. ✅ test_compress_large_images - 压缩大图片
2. ✅ test_skip_small_images - 跳过小图片
3. ✅ test_preserve_directory_structure - 保持目录结构
4. ✅ test_output_to_custom_path - 输出到指定目录
5. ✅ test_validation_failure_adds_error_suffix - 验证失败添加后缀
6. ✅ test_non_image_files_unchanged - 非图片文件不变
7. ✅ test_performance_benchmark - 性能基准测试

## 🔄 实施流程

### Phase 1: 核心模块（40分钟）
1. 创建目录结构
2. 实现 `validator.py`
   - `compare_archive_structure()` 函数
   - `ArchiveComparisonResult` 数据类
3. 实现 `service.py`
   - `compress_archive_images()` 主函数
   - 图片压缩逻辑
   - 临时目录管理
4. 添加配置项到 `config.py`

### Phase 2: API 集成（15分钟）
1. 在 `fs.py` 添加端点
2. 定义请求/响应模型
3. 集成验证逻辑
4. 错误处理和日志

### Phase 3: 单元测试（40分钟）
1. 创建测试目录和 conftest
2. 编写 validator 测试（5个用例）
3. 编写 compressor 测试（7个用例）
4. 运行测试确保覆盖率 > 85%

### Phase 4: 集成测试（15分钟）
1. 端到端测试
2. 性能基准测试
3. 边界情况验证

## 💡 技术细节

### 图片压缩实现
```python
from PIL import Image, ImageOps

def compress_image(input_path: Path, output_path: Path, max_width: int, max_height: int, quality: int):
    with Image.open(input_path) as img:
        # 处理 EXIF 旋转
        img = ImageOps.exif_transpose(img)
        
        # 转换为 RGB（JPEG 不支持透明度）
        if img.mode in ("RGBA", "LA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            rgb_img.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = rgb_img
        elif img.mode != "RGB":
            img = img.convert("RGB")
        
        # 缩放（保持宽高比）
        if img.width > max_width or img.height > max_height:
            img.thumbnail((max_width, max_height), Image.Resampling.BILINEAR)
        
        # 保存为 JPEG
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path, "JPEG", quality=quality, optimize=True)
```

### 验证逻辑
```python
def compare_archive_structure(original: Path, compressed: Path) -> ArchiveComparisonResult:
    # 1. 列出所有文件
    original_entries = set(list_entries(original))
    compressed_entries = set(list_entries(compressed))
    
    # 2. 比较文件列表
    if original_entries != compressed_entries:
        return ArchiveComparisonResult(is_valid=False, ...)
    
    # 3. 解压到临时目录
    with tempfile.TemporaryDirectory() as tmp1, tempfile.TemporaryDirectory() as tmp2:
        extract_all(original, Path(tmp1))
        extract_all(compressed, Path(tmp2))
        
        # 4. 逐文件比较
        for entry in original_entries:
            file1 = Path(tmp1) / entry
            file2 = Path(tmp2) / entry
            
            # 非图片文件：字节级比较
            if not is_image(entry):
                if file1.read_bytes() != file2.read_bytes():
                    return ArchiveComparisonResult(is_valid=False, ...)
            
            # 图片文件：验证可打开
            else:
                try:
                    with Image.open(file2) as img:
                        img.verify()
                except Exception:
                    return ArchiveComparisonResult(is_valid=False, corrupted_images=[entry])
    
    return ArchiveComparisonResult(is_valid=True, ...)
```

## 📝 注释规范

在关键位置添加注释，预留进度反馈接口：

```python
# TODO: 进度反馈 - 可在此处添加进度回调
# progress_callback(current=i, total=len(images), message=f"压缩中: {image_name}")
```

## ⏱️ 预估时间

- Phase 1: 40 分钟
- Phase 2: 15 分钟
- Phase 3: 40 分钟
- Phase 4: 15 分钟
- **总计**: 110 分钟（约 1 小时 50 分钟）

## ✅ 完成标准

1. ✅ 所有单元测试通过
2. ✅ 测试覆盖率 > 85%
3. ✅ 验证逻辑独立且有专门测试
4. ✅ 压缩失败时输出文件添加 `.error` 后缀
5. ✅ 代码中添加进度反馈注释
6. ✅ 符合 TDD 开发流程
