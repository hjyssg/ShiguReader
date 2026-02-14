# Task2 实施计划：解压结构与 Reader / Explorer 重构

## 📋 需求确认

- ✅ 解压逻辑：按 zip 内部原始目录结构解压（不使用 flat 结构）
- ✅ Reader：可直接打开 cache 中的文件
- ✅ Reader：支持以 Explorer 模式浏览
- ✅ 删除 Reader Overview 页面
- ✅ 保留 Waterfall 模式
- ✅ Explorer 模式：当前功能已满足需求，无需额外修改

## 🔍 当前状况分析

### 后端现状
- ✅ `stepwise_extractor` 已支持保持目录结构解压
- ✅ `_archive_backend.py` 的 `extract_entries()` 保持原始路径
- ✅ `/archive/extract` API 支持三阶段解压
- ✅ `/archive/file` API 支持从 cache 读取文件
- **结论：后端无需修改**

### 前端现状
- ✅ Reader 页面 (`/read`) 已支持 archive 和 folder 两种 source
- ✅ Reader 已经可以打开 cache 中的文件
- ⚠️ Reader Overview 页面 (`/read-overview`) 需要删除
- ⚠️ Reader 缺少到 Explorer 模式的快速切换按钮
- ✅ Waterfall 模式 (`/read-waterfall`) 保留

## 🎯 实施方案

### 1. 后端验证（无需修改）

**验证项：**
1. ✅ 解压保持目录结构
   - 检查 `extract_entries()` 实现
   - 验证 cache 目录结构
2. ✅ cache 文件访问
   - 测试 `/archive/file` 端点
   - 验证路径解析正确

### 2. 前端修改

#### A. 删除 Reader Overview 页面

**需要删除的文件：**
```
frontend/src/routes/_layout/read-overview.tsx
```

**需要修改的文件：**
1. `frontend/src/routes/_layout/read.tsx`
   - 移除 Overview 按钮
   - 保留 Waterfall 按钮
   - 添加 Explorer 模式按钮

2. `frontend/src/routes/_layout/archive.tsx`
   - 检查是否有 Overview 相关引用
   - 确保导航逻辑正确

#### B. Reader 页面增强

在 `read.tsx` 中修改按钮区域：

**当前代码：**
```tsx
<div className="flex items-center gap-2">
  {!isFolderSource && (
    <>
      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-overview", search: { path } })}>Overview</Button>
      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-waterfall", search: { path } })}>Waterfall</Button>
    </>
  )}
</div>
```

**修改为：**
```tsx
<div className="flex items-center gap-2">
  {!isFolderSource && (
    <>
      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/archive", search: { path } })}>Explorer</Button>
      <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-waterfall", search: { path } })}>Waterfall</Button>
    </>
  )}
</div>
```

#### C. 路由清理

检查并更新路由相关文件：
- 确保没有其他地方引用 `/read-overview`
- 验证路由生成文件 `routeTree.gen.ts`（自动生成，删除文件后会更新）

## 📝 实施步骤

### Phase 1: 后端验证（10分钟）
1. ✅ 阅读 `_archive_backend.py` 确认解压逻辑
2. ✅ 检查 `stepwise_extractor` 实现
3. ✅ 验证 cache 目录结构示例
4. ✅ 确认无需修改

### Phase 2: 删除 Overview 页面（10分钟）
1. 删除 `frontend/src/routes/_layout/read-overview.tsx`
2. 搜索项目中所有 `read-overview` 引用
3. 清理相关导入和引用

### Phase 3: 修改 Reader 页面（15分钟）
1. 修改 `read.tsx` 按钮区域
2. 移除 Overview 按钮
3. 添加 Explorer 按钮
4. 保留 Waterfall 按钮
5. 测试按钮功能

### Phase 4: 测试验证（20分钟）
1. 测试解压后的目录结构
2. 测试 Reader 打开 cache 文件
3. 测试 Explorer 模式切换
4. 测试 Waterfall 模式切换
5. 验证面包屑导航
6. 端到端测试

## 🧪 测试场景

### 1. 解压目录结构测试
```
测试 zip 结构：
archive.zip
├── folder1/
│   ├── image1.jpg
│   └── image2.png
└── folder2/
    └── image3.jpg

预期 cache 结构：
extract_cache/{hash}/
├── folder1/
│   ├── image1.jpg
│   └── image2.png
└── folder2/
    └── image3.jpg
```

### 2. Reader 功能测试
- ✅ 打开压缩包，验证图片正常显示
- ✅ 翻页，验证图片路径正确
- ✅ 点击 Explorer 按钮，跳转到 Archive 页面
- ✅ 点击 Waterfall 按钮，跳转到 Waterfall 页面
- ✅ 验证面包屑导航正确

### 3. 导航流程测试
```
Explorer → Reader → Explorer (循环测试)
Explorer → Reader → Waterfall → Reader
```

## 📁 涉及的文件

### 需要删除
- `frontend/src/routes/_layout/read-overview.tsx`

### 需要修改
- `frontend/src/routes/_layout/read.tsx`

### 需要验证（可能无需修改）
- `frontend/src/routes/_layout/archive.tsx`
- `frontend/src/routes/_layout/read-waterfall.tsx`
- `backend/app/file_processing/_archive_backend.py`
- `backend/app/file_processing/stepwise_extractor/service.py`

## 💡 技术细节

### 解压逻辑验证

当前 `extract_entries()` 实现：
```python
def extract_entries(archive_path: Path, destination: Path, entries: list[str]) -> None:
    kind = archive_kind(archive_path)
    destination.mkdir(parents=True, exist_ok=True)

    if kind == "zip":
        with zipfile.ZipFile(archive_path, "r") as zf:
            for entry in entries:
                zf.extract(entry, path=destination)  # ✅ 保持原始路径
        return
    # ... 其他格式类似
```

**结论：** `zf.extract(entry, path=destination)` 会自动保持 entry 的目录结构，无需修改。

### Reader 按钮布局

修改后的按钮区域：
```tsx
<div className="flex items-center justify-between gap-2">
  <div className="text-sm text-muted-foreground truncate">{currentEntry.name}</div>
  <div className="flex items-center gap-2">
    {!isFolderSource && (
      <>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/archive", search: { path } })}>
          Explorer
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/read-waterfall", search: { path } })}>
          Waterfall
        </Button>
      </>
    )}
  </div>
</div>
```

## ⏱️ 预估时间

- Phase 1: 10 分钟（后端验证）
- Phase 2: 10 分钟（删除 Overview）
- Phase 3: 15 分钟（修改 Reader）
- Phase 4: 20 分钟（测试验证）
- **总计**: 55 分钟（约 1 小时）

## ✅ 完成标准

1. ✅ 后端解压逻辑保持目录结构（已验证）
2. ✅ Reader Overview 页面已删除
3. ✅ Reader 页面有 Explorer 模式按钮
4. ✅ Waterfall 模式保留且正常工作
5. ✅ 所有导航流程测试通过
6. ✅ 无残留的 Overview 引用
7. ✅ cache 文件访问正常

## 🔄 回滚计划

如果出现问题，可以通过 git 回滚：
```bash
git checkout frontend/src/routes/_layout/read-overview.tsx
git checkout frontend/src/routes/_layout/read.tsx
```

## 📌 注意事项

1. 删除文件后，TanStack Router 会自动重新生成 `routeTree.gen.ts`
2. 需要重启前端开发服务器以应用路由变更
3. 测试时注意清理浏览器缓存
4. 验证所有页面的面包屑导航是否正确
