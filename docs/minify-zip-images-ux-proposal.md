# Minify ZIP Images 交互方案说明（Review Draft）

> 目标：解决当前文案与行为中“直接替换原压缩包”带来的不适感，同时保持功能简单、可预期。

## 1. 现状问题

当前文案：

> This will compress large images inside the archive and repack it. The original archive will be replaced.

用户感受上的主要问题：

- 默认看起来是“不可逆操作”
- 用户在未充分确认前就会担心原文件被改坏
- 对首次使用者不友好（尤其对珍藏压缩包）

---

## 2. 设计目标

1. 默认安全（不破坏原文件）
2. 高级用户仍可选择覆盖原文件
3. 交互保持简洁（不增加过多确认步骤）

---

## 3. 推荐交互（按你的反馈简化版）

你已明确：

- 不需要“替换原文件时二次确认文案”
- 不需要“Keep backup(.bak) 选项”

因此采用以下简化方案：

### 3.1 对话框选项

- Action: `Minify ZIP Images`
- Mode（单选）
  - `Create new archive (recommended)`（默认）
  - `Replace original archive`

> 不再追加二次确认弹窗。

### 3.2 文案建议

主描述文案改为：

> Large images in this archive will be recompressed and repacked.
> By default, a new archive is created and the original file is kept.

当选择 `Replace original archive` 时，仅显示一行轻量提示（非二次确认）：

> The original archive will be overwritten.

---

## 4. 后端行为建议（实现层）

即使没有二次确认，也建议用“先产出新包，再提交”的流程，避免损坏：

1. 解压并压缩图片到临时目录
2. 生成临时输出包（如 `xxx.tmp.zip`）
3. `7z t` 完整性校验
4. 根据 mode 提交结果：
   - `new`：移动到目标输出名（如 `xxx.min.zip`）
   - `replace`：校验成功后原子替换为原路径

失败时：不改动原文件。

---

## 5. API 变更（最小集）

`POST /archive/compress-images` 请求体建议新增：

```ts
{
  archive_path: string
  mode?: "new" | "replace"   // default: "new"
  output_path?: string          // mode=new 时可选
  max_height?: number
  quality?: number
}
```

返回建议新增：

```ts
{
  processed: number
  original_bytes: number
  output_bytes: number
  saved_bytes: number
  output_path: string
  replaced: boolean
}
```

---

## 6. 前端改动范围（最小集）

1. `CompressDialog.tsx`
   - 为 `minify-zip-images` 增加 mode 单选项（默认 `new`）
   - 更新描述文案（从“默认替换”改成“默认新建”）
2. 触发压缩的 mutation
   - 调用接口时传 `mode`
3. 成功提示
   - `new`: `Minified archive created`
   - `replace`: `Original archive replaced`

---

## 7. 测试关注点

1. `mode=new`：原文件不变，生成新文件
2. `mode=replace`：原路径文件被新包替换
3. 压缩/打包失败：原文件保持不变
4. 输出路径冲突时行为清晰（自动改名或返回冲突）

---

## 8. 增加 `listZipContent` 对比校验（你补充的要求）

你提到希望额外有一个 `listzipcontent`，用于比较“输出 ZIP 的内容文件是否和原 ZIP 一致”。

### 8.1 目的

在 Minify 后做一次“内容清单一致性检查”（不比较字节，只比较条目集合），确保：

- 没丢文件
- 没多文件
- 目录结构/文件名集合一致

### 8.2 建议接口

可在现有 `/archive/list` 基础上封装，也可新增接口：

`POST /archive/compare-content`

请求：

```ts
{
  source_archive_path: string
  output_archive_path: string
}
```

返回：

```ts
{
  matched: boolean
  source_count: number
  output_count: number
  missing_in_output: string[]   // source 有、output 没有
  extra_in_output: string[]     // output 有、source 没有
}
```

### 8.3 校验规则建议

1. 两边都调用 `listEntries`（或 listZipContent）
2. 取 `entry_path` 做集合比较
3. 默认忽略顺序（因为重打包后顺序可能变化）
4. 只要 `missing_in_output` 和 `extra_in_output` 都为空，即视为 `matched=true`

> 说明：这是“内容项一致性”，不是“文件内容二进制一致性”。图片压缩后体积变化属于预期。

---

## 9. 临时解压位置说明

当前后端实现里，Minify 过程使用系统临时目录：

- 创建方式：`fs.mkdtempSync(path.join(os.tmpdir(), "shigure-compress-"))`
- 典型路径（Windows）：`C:\Users\<用户名>\AppData\Local\Temp\shigure-compress-xxxxxx`

生命周期：

- 压缩流程结束后（成功或失败）都会在 `finally` 中执行：
  `fs.rmSync(tmpDir, { recursive: true, force: true })`
- 即：默认不会长期残留。

---

## 10. 结论

本方案在不增加“二次确认”和“备份选项”的前提下，仍能实现：

- 默认安全
- 可覆盖原文件
- 交互简洁

适合先快速上线并观察反馈，后续再决定是否补充高级选项。
