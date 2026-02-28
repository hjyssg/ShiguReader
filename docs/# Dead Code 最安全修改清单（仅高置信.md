# Dead Code 最安全修改清单（仅高置信）

> 目标：只列出“最明确、最安全”的清理项，优先保证零功能风险。




### 2) 同步清理无用 import（若删除上述文件后出现）

- 预期影响极小，通常由 ESLint/TS 自动提示。

---

## 第二批（同样高置信，但建议单独提交）

### 3) 删除后端 `IndexRepository` 未引用方法（符号级）

以下方法仅有定义、无调用（仓库内静态引用）：

- `batchUpsertFiles`
- `deleteFile`
- `markFileDeleted`
- `deleteByPrefix`
- `countFilesByType`
- `batchUpsertFolders`
- `getArchiveMeta`
- `getParsedMetadataByFilepaths`

> 建议：这 8 个方法作为单独 PR 清理，便于回滚。

### 4) 删除后端 service 未引用导出（符号级）


- `backend/src/services/reconcileQueue.ts`
  - `flushNow`（注释标注“测试用”）
  - `resetQueue`（注释标注“测试用”）

---


---

## 推荐执行顺序

1. 先删 4 个前端未引用文件（最安全）。
2. 构建验证前端无 TS 报错。
3. 再删后端未引用方法/导出（分两次提交更稳）。
4. 运行后端启动与关键 API 冒烟验证。
