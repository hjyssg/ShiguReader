# Minify Zip Images — 变更 Review

## 改动概览

实现了业务文档（`压缩包的内部图片压缩业务方案.md`）中定义的两种输出模式，以及新旧 zip 条目集合对比。

---

## 后端

### `backendnode/src/services/archiveService.ts`

**新增类型**
```ts
export type CompressOutputMode = "new" | "replace"

export interface CompressArchiveImagesResult {
  processed: number
  original_bytes: number
  output_bytes: number
  output_path: string          // 实际输出路径
  output_mode: CompressOutputMode
  entries_matched: boolean     // 新旧条目集合是否一致
  source_entry_count: number
  output_entry_count: number
  missing_entries: string[]    // 源包有、输出包没有的条目
  extra_entries: string[]      // 输出包多出的条目
}
```

**新增函数 `compareZipEntries`**
- 调用两次 `listEntries`，对比条目路径集合（Set 差集）
- 忽略顺序差异，只比较路径字符串

**`compressArchiveImages` 变更**
- 新增第 4 个参数 `outputMode: CompressOutputMode = "new"`
- `new` 模式：行为与之前一致，输出到 `<name>_compressed.<ext>`
- `replace` 模式：
  1. 先输出到临时文件 `<name>_tmp_<timestamp>.<ext>`
  2. `7z t` 完整性校验
  3. `compareZipEntries` 条目对比，不一致则删除临时文件并抛错
  4. 全部通过后 `fs.renameSync` 原子覆盖原文件
  5. 清除 `entriesCache` 中原文件的缓存
- `finally` 块确保临时文件在任何失败路径下都被清理

**注意事项**
- `compareZipEntries` 复用了 `listEntries`，而 `listEntries` 只过滤媒体文件（image/video/audio）。非媒体文件（如 txt）不在对比范围内。这与业务文档"条目集合"的定义一致，但如果你希望对比所有文件，需要另写一个不过滤的版本。

---

### `backendnode/src/routes/fsArchive.ts`

`compressImages` handler 变更：
- Body 新增 `output_mode?: "new" | "replace" | null`
- 默认值为 `"new"`（非 `"replace"` 的任何值都 fallback 到 `"new"`）
- 传给 `compressArchiveImages` 的第 4 个参数

---

## 前端

### `CompressDialog.tsx`

- `onConfirm` 签名改为 `(outputMode?: MinifyOutputMode) => void`
- `minify-zip-images` action 时，dialog body 增加 RadioGroup：
  - 默认选中"生成新文件（保留原文件）"
  - 可选"覆盖原文件"
- `zip-folder` action 不显示 radio，`onConfirm` 传 `undefined`

### `useFileOperations.ts`

- `compressArchiveImagesMutation` 的 `mutationFn` 参数从 `string` 改为 `{ archivePath, outputMode? }`
- 请求 body 增加 `output_mode` 字段

### `useFileOperationDialogs.tsx`

- `onConfirm` 接收 `outputMode?: MinifyOutputMode`
- minify 分支改为 `mutate({ archivePath: compressTarget, outputMode })`

### i18n（zh / en / ja / ko）

- `minifyZipImagesDescription`：修正描述，说明默认生成新文件
- 新增 `minifyOutputModeNew` / `minifyOutputModeReplace` 两个 key

---

## 需要 Review 的点

1. **条目对比范围**：`compareZipEntries` 只对比媒体文件条目（复用 `listEntries` 的过滤逻辑）。如果压缩包里有非媒体文件（txt、pdf 等），它们不参与对比。是否需要改为对比全部条目？

2. **`replace` 模式条目不一致时的行为**：目前是直接抛错、删除临时文件、不覆盖原文件。业务文档要求"任一失败不得破坏原 ZIP"，这里满足了。但前端目前只显示通用错误 toast，没有区分"条目不一致"和其他错误。是否需要更细的错误提示？

3. **`new` 模式不做条目对比**：目前 `new` 模式也会执行 `compareZipEntries` 并把结果返回给前端，但前端没有展示这个信息。是否需要在 toast 里显示 `entries_matched` 结论？

4. **RadioGroup 组件**：`CompressDialog` 引入了 `RadioGroup` 和 `RadioGroupItem`，需要确认 shadcn/ui 的 radio-group 组件已经在项目中安装（`components.json` 里有配置）。
