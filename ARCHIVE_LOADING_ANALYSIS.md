# 压缩文件前几页加载失败问题分析

## 问题描述
用户反馈：打开压缩文件（如 .cbz, .zip）时，前几页总是加载失败。

## 根本原因分析

通过分析代码，我发现了以下问题：

### 1. **异步解压与同步请求的竞态条件**

在 `backend/app/api/routes/fs.py` 中：

```python
@router.post("/archive/extract", response_model=ExtractStatus)
async def extract_archive(
    background_tasks: BackgroundTasks,
    path: str = Query(...),
    page: int = Query(0),
) -> ExtractStatus:
    # ...
    # 启动后台解压任务
    background_tasks.add_task(extract_task)
    
    # 立即返回 "extracting" 状态
    return ExtractStatus(
        status="extracting",
        extracted_count=0,
        total_count=0,
        cache_dir=str(cache_dir),
    )
```

**问题**：
- `/archive/extract` 端点立即返回，解压在后台进行
- 前端可能在解压完成前就请求 `/archive/file`
- 导致 404 错误："File not extracted yet"

### 2. **分步解压的优先级问题**

在 `stepwise_extractor/service.py` 中：

```python
def stepwise_extract(
    archive_path: str | Path,
    output_dir: str | Path,
    *,
    prioritized_entries: list[str] | None = None,
    ...
):
    # 第一阶段：解压优先文件
    extract_entries(archive, work_dir, first_stage)
    
    # 第二阶段：解压其余文件
    extract_entries(archive, work_dir, second_stage)
    
    # 原子性替换目录
    replace_dir_atomic(work_dir, out_dir)
```

**问题**：
- 虽然有优先级解压（当前页 ±10 页），但使用 `replace_dir_atomic`
- 这意味着**只有全部解压完成后，文件才会出现在 cache_dir**
- 前端在第一阶段完成后请求文件，仍然会 404

### 3. **前端请求时序问题**

典型的请求流程：
1. 前端调用 `/archive/extract?page=0`
2. 后端返回 `status: "extracting"`
3. 前端立即请求 `/archive/file?entry=page_0.jpg`
4. 后端返回 404（文件还在临时目录，未移动到 cache_dir）

## 解决方案

### 方案 1：渐进式文件可用（推荐）

修改 `stepwise_extract` 使第一阶段文件立即可用：

```python
def stepwise_extract(...):
    # 第一阶段：直接解压到目标目录
    out_dir.mkdir(parents=True, exist_ok=True)
    extract_entries(archive, out_dir, first_stage)
    
    # 第二阶段：解压到临时目录，然后合并
    work_dir = Path(tempfile.mkdtemp(prefix="stepwise-"))
    try:
        extract_entries(archive, work_dir, second_stage)
        # 将第二阶段文件移动到目标目录
        for file in work_dir.rglob("*"):
            if file.is_file():
                dest = out_dir / file.relative_to(work_dir)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(file), str(dest))
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
```

**优点**：
- 第一阶段文件（当前页附近）立即可用
- 用户可以立即开始阅读
- 后台继续解压其余文件

### 方案 2：同步等待第一阶段

修改 `/archive/extract` 端点，等待第一阶段完成：

```python
@router.post("/archive/extract")
async def extract_archive(...):
    # 同步解压第一阶段
    await asyncio.to_thread(
        extract_first_stage,
        validated_path,
        cache_dir,
        prioritized_entries,
    )
    
    # 后台解压第二阶段
    background_tasks.add_task(extract_second_stage, ...)
    
    return ExtractStatus(
        status="completed",  # 第一阶段完成
        extracted_count=len(prioritized_entries),
        ...
    )
```

**优点**：
- 确保前端请求时文件已存在
- 第一阶段完成后立即返回

**缺点**：
- 增加 API 响应时间（约 1-3 秒）

### 方案 3：前端轮询机制

前端在请求文件前，先轮询检查文件是否存在：

```typescript
async function waitForFile(archivePath: string, entry: string) {
    for (let i = 0; i < 30; i++) {
        try {
            const response = await fetch(`/api/v1/fs/archive/file?path=${archivePath}&entry=${entry}`);
            if (response.ok) return response;
        } catch (e) {
            // 继续等待
        }
        await sleep(100); // 等待 100ms
    }
    throw new Error("File extraction timeout");
}
```

**优点**：
- 后端改动最小

**缺点**：
- 前端逻辑复杂
- 用户体验不佳（需要等待）

## 推荐实施方案

**方案 1（渐进式文件可用）+ 前端优化**

1. 修改 `stepwise_extract` 使第一阶段文件立即可用
2. 前端添加简单的重试机制（最多 3 次，间隔 500ms）
3. 添加加载状态提示

这样可以：
- 最小化用户等待时间
- 提供良好的用户体验
- 保持代码简洁

## 需要修改的文件

1. `backend/app/file_processing/stepwise_extractor/service.py` - 实现渐进式解压
2. `backend/app/api/routes/fs.py` - 可选：添加文件存在性检查端点
3. `frontend/src/...` - 添加重试逻辑和加载提示

## 测试建议

1. 使用大型压缩文件（100+ 图片）测试
2. 验证前几页立即可用
3. 验证后续页面逐步可用
4. 测试并发打开多个压缩文件的情况
