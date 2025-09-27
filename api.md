# Explorer 核心 API 返回结构

本文档总结前端 Explorer 页面依赖的核心后端接口返回值格式，便于在调试或扩展功能时参考。所有接口返回 JSON，并在失败时带有 `failed` 与 `reason` 字段。

## `POST /api/folder/list_dir`

- **请求体**
  - `dir` (`string`, 必填)：要浏览的绝对路径。
  - `isRecursive` (`boolean`, 选填)：为 `true` 时返回包含子目录的文件数据。

- **成功响应**（关键字段）
  - `path` (`string`)：解析后的目录绝对路径。
  - `dirs` (`string[]`)：当前层级下的子目录绝对路径列表。
  - `fileInfos` (`Record<string, FileInfo>`): 以文件绝对路径为键的文件信息表。
  - `imgFolderInfo` (`Record<string, ImgFolderInfo>`): 需要在 Explorer 中合并展示的图像文件夹聚合信息。
  - `fileHistory` (`Array<{ fileName: string; time: number; count: number; }>`): 最近访问记录；`time` 为最近访问的毫秒时间戳，`count` 为访问次数。
  - `nameParseCache` (`Record<string, NameParseResult>`): 以文件或文件夹名为键的解析缓存。结构与 `@name-parser` 的输出一致，通常包含 `title`、`author`、`tags`、`event`、`dateTag` 等字段。
  - `mode` (`string`, 可选)：当后端尚未扫描该目录时为 `"lack_info_mode"`。

- **FileInfo**
  - `size` (`number`): 文件大小（字节）。
  - `mtimeMs` (`number`): 文件最近修改时间的毫秒时间戳。
  - `thumbnailFilePath` (`string`, 可选): 预生成缩略图文件的绝对路径。
  - `pageNum` / `musicNum` / `videoNum` / `totalNum` (`number`, 可选): 对压缩包解析出的页数、音频数、视频数及资源总数。
  - `totalImgSize` (`number`, 可选): 压缩包内图片总大小（字节）。

- **ImgFolderInfo**
  - `mtimeMs` (`number`): 文件夹内图像类文件的平均修改时间。
  - `size` (`number`): 图像文件总大小（字节）。
  - `totalImgSize` (`number`): 仅图片的总大小（字节）。
  - `pageNum` (`number`): 图片数量。
  - `musicNum` (`number`): 音频文件数量。
  - `videoNum` (`number`): 视频文件数量。
  - `thumbnail` (`string`): 作为封面的文件路径；若无可用资源则为 `"NO_THUMBNAIL_AVAILABLE"`。

## `POST /api/search/search_file`

- **请求体**
  - `mode` (`"mode tag" | "mode author" | "mode search"`): 搜索模式，通常对应 `@common/constant` 中的常量。
  - `text` (`string`): 搜索关键词、标签或作者。

- **成功响应**
  - `tag` (`string`, 当 `mode` 为标签搜索时出现)。
  - `author` (`string`, 当 `mode` 为作者搜索时出现)。
  - `dirs`、`fileInfos`、`imgFolderInfo`、`fileHistory`、`nameParseCache`：结构与 `list_dir` 返回值一致，方便 Explorer 直接渲染结果。

两接口都会在失败时返回 `{ failed: true, reason: string }`，前端应做好提示或降级处理。
