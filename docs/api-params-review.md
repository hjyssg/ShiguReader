# API 参数 Review（search / listdir / extract / thumbnail）

本次仅 review 4 个接口：

- `POST /api/v1/search`
- `GET /api/v1/fs/listdir`
- `POST /api/v1/fs/archive/extract`
- `GET /api/v1/thumbnail`

## 结论（多余参数）

### 1) `POST /api/v1/search`

- **候选多余参数：`limit`、`offset`（当前前端未使用）**
  - 后端支持 `limit/offset`，但当前前端调用未传这两个参数。
  - 目前搜索页分页是前端对返回结果二次分页，不依赖后端分页。
  - 如果后续不打算做后端分页，可考虑删除；若计划支持大结果集分页，建议保留并在前端接入。

### 2) `GET /api/v1/fs/listdir`

- **候选多余参数：`sort_by`、`sort_order`（当前前端主流程未使用）**
  - 后端支持按字段排序。
  - 但当前前端 explorer 请求只传 `path`，并且由前端组件再次排序展示。
  - 若统一由前端排序，可考虑删除后端排序参数；否则建议保留用于外部调用/未来服务端分页。

### 3) `POST /api/v1/fs/archive/extract`

- **未发现多余参数**
  - `path` 必需。
  - `page` 用于优先级解压策略（当前页优先），属于有效参数。

### 4) `GET /api/v1/thumbnail`

- **未发现明显多余参数**
  - `type` 与 `name` 组合用于实体缩略图检索。
  - `type` 目前限定 `tag|author|coser`，语义明确。

## 建议

- 本轮先不做破坏性删除，只标记“候选多余参数”。
- 若要真正收口参数，建议分两步：
  1. 前端先切换到唯一策略（全前端排序或全后端分页）；
  2. 再删除对应参数并更新 SDK / 文档。
