# Archive → Explorer 重构方案

## 背景

原来点击 archive 文件会跳转到 `/archive` 页面（专门的压缩包查看器），显示 zip 内容列表。
新方案：直接用 Explorer 展示解压后的文件夹，删除 `/archive` 页面。

## 新流程

```
点击 archive 文件
  → 跳转 /explorer?path=<archive路径>&archivePath=<archive路径>
  → Explorer 检测到 archivePath 参数
  → 调用 extractArchive API（后台解压）
  → 成功后 replace 到 /explorer?path=<cache_dir>
  → 正常展示解压后的文件列表
```

## 改动清单

### 新增
- `frontend/src/hooks/useArchiveExtract.ts` — 封装解压+重定向逻辑的 hook

### 修改
- `frontend/src/routes/_layout/explorer.tsx`
  - validateSearch 加 `archivePath?: string`
  - 使用 `useArchiveExtract` hook
  - 解压期间显示 loading skeleton

- `frontend/src/hooks/useFileNavigation.ts`
  - archive 文件跳转改为 `/explorer?path=xxx&archivePath=xxx`（立即跳转，无 API 调用）

- `frontend/src/routes/_layout/read.tsx`
  - ESC 返回：archive source 改为 `/explorer?archivePath=<path>`
  - 面包屑 currentTo：archive source 改为 `/explorer`，currentSearch 加 archivePath
  - "Explorer" 按钮链接同上
  - audio mode 面包屑同上

- `frontend/src/routes/_layout/read-waterfall.tsx`
  - 面包屑 extraCrumbs 里的 `/archive` 改为 `/explorer?archivePath=<path>`

- `frontend/src/routes/_layout/read-mobile.tsx`
  - close 时返回：archive source 改为 `/explorer?archivePath=<path>`

- `frontend/src/routes/_layout/video.tsx`
  - 面包屑 extraCrumbs 里的 `/archive` 改为 `/explorer?archivePath=<path>`

- `frontend/src/routes/_layout/audio.tsx`
  - 面包屑 extraCrumbs 里的 `/archive` 改为 `/explorer?archivePath=<path>`

### 删除
- `frontend/src/routes/_layout/archive.tsx`

## 注意事项

- 从 read 页面返回时，archive 通常已经解压过，`extractArchive` 会命中缓存，几乎无延迟
- `archivePath` 参数只在 explorer 内部消费，不会持久化到 URL（replace 后消失）
- 旧的 `/archive` URL 书签会失效（可接受）
