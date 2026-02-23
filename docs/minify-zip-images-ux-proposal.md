# Minify ZIP Images 需求整理（交接版）

> 目的：给 Claude（或其他同事）直接接手用。此文档只保留**已确认决策、明确接口、验收标准、实现清单**，避免反复沟通。

---

## 1) 背景与核心问题

当前提示文案是：

> This will compress large images inside the archive and repack it. The original archive will be replaced.

问题：默认“替换原包”让用户不舒服，缺少可选项。

---

## 2) 已确认产品决策（必须遵守）

1. Minify 必须提供输出模式选择：
   - `new`：新建压缩包（默认）
   - `replace`：覆盖原压缩包
2. **不要**额外加二次确认弹窗。
3. **不要**加 `keep backup(.bak)` 这种 UI 选项。
4. 需要提供 ZIP 内容清单对比能力（`listZipContent/compare`），用于确认输出包条目与原包一致。
5. 需要在返回/说明中交代临时解压目录信息。

---

## 3) 交互与文案（前端）

### 3.1 对话框

- 标题：`Minify ZIP Images`
- 描述：

  ```text
  Large images in this archive will be recompressed and repacked.
  By default, a new archive is created and the original file is kept.
  ```

- 模式单选：
  - `Create new archive (recommended)`（默认）
  - `Replace original archive`
- 当选中 replace 时，仅显示轻量提示（非弹窗）：

  ```text
  The original archive will be overwritten.
  ```

### 3.2 成功提示

- `new`：`Minified archive created`
- `replace`：`Original archive replaced`
- 补充 compare 结果：`Content compare: matched / mismatch`

---

## 4) 后端接口契约

### 4.1 压缩接口

`POST /api/v1/fs/archive/compress-images`

请求：

```ts
{
  archive_path: string
  mode?: "new" | "replace"   // default: "new"
  output_path?: string | null   // mode=new 可选
  max_height?: number | null
  quality?: number | null
}
```

响应（建议）：

```ts
{
  processed: number
  original_bytes: number
  output_bytes: number
  saved_bytes: number
  output_path: string
  replaced: boolean
  content_compare: {
    matched: boolean
    source_count: number
    output_count: number
    missing_in_output: string[]
    extra_in_output: string[]
  }
  temp_dir_base: string          // e.g. os.tmpdir()
  temp_dir_pattern: string       // "shigure-compress-*"
}
```

### 4.2 ZIP 清单接口

`GET /api/v1/fs/archive/list-zip-content?path=...`

响应：

```ts
{
  entries: Array<{
    name: string
    entry_path: string
    size: number
    is_dir: boolean
  }>
  total: number
}
```

### 4.3 ZIP 对比接口

`POST /api/v1/fs/archive/compare-content`

请求：

```ts
{
  source_archive_path: string
  output_archive_path: string
}
```

响应：

```ts
{
  matched: boolean
  source_count: number
  output_count: number
  missing_in_output: string[]
  extra_in_output: string[]
}
```

---

## 5) 关键实现规则（服务端）

1. 统一流程：解压 → 压图 → 重打包 → `7z t` 校验。
2. `replace` 模式也应先输出临时包，再提交替换（避免原包损坏）。
3. compare 只做“条目集合一致性”（按 `entry_path` 集合比较，忽略顺序）。
4. 临时目录使用：
   - `fs.mkdtempSync(path.join(os.tmpdir(), "shigure-compress-"))`
   - 在 `finally` 中清理：`fs.rmSync(tmpDir, { recursive: true, force: true })`

---

## 6) 验收标准（QA）

1. `mode=new`：原文件不变，输出新 ZIP，接口返回 `replaced=false`。
2. `mode=replace`：原路径最终是新 ZIP，接口返回 `replaced=true`。
3. 任意失败（压图失败/打包失败/校验失败）不应破坏原包。
4. `list-zip-content` 可稳定返回条目列表。
5. `compare-content` 能准确给出 `missing_in_output / extra_in_output`。
6. 前端可选模式、传参正确、成功提示包含 compare 结果。

---

## 7) Claude 接手任务清单（可直接照做）

1. 对照本文件，统一后端 `compress-images` 入参与返回结构。
2. 确认 `replace` 的提交与回滚策略健壮。
3. 完成 `list-zip-content` 与 `compare-content` 路由与测试。
4. 前端 `CompressDialog` 增加 mode 单选并透传。
5. 调整前端 toast：展示输出模式 + compare 结论。
6. 跑 `backendnode` 路由测试与 `frontend` build，修到全绿。

---

## 8) 备注

- 本文是“交接文档”，不是最终技术设计文档。
- 若实现细节与本文冲突，以“第 2 节已确认决策”为最高优先级。
