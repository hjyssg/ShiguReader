# 旧版 ShiguReader 的 URL 路径处理（简要）

本文记录旧版前端在“路径放进 query 参数”时的核心做法，便于新版对齐行为。

## 1. 链接构建

- 旧版把路径作为单个 query 参数传递（常见键是 `p`）
- 典型写法：

```js
"/explorer/?p=" + encodeURIComponent(path)
"/book/?p=" + encodeURIComponent(path)
```

- 重点：路径值会先 `encodeURIComponent`，再拼到 URL 里

## 2. query 解析

- 旧版使用 `query-string` 库解析 query
- 与 `URLSearchParams` 行为差异点：
  - `query-string` 的传统语义里，`+` 会按空格处理
  - 字面 `+` 应该使用 `%2B` 表示

## 3. 对 space / plus 的影响

- 路径里若是空格，最终可表现为 `%20`（或在某些链路表现为 `+`）
- 路径里若是字面加号，应该编码为 `%2B`
- 因此解析时必须遵循同一套语义，否则会出现：
  - 空格路径被误判成加号路径，导致后端 404

## 4. 新版对齐原则

1. 解析端保持旧版语义：`+` 视为空格
2. 序列化不要重复加 `?`，避免 `??`
3. 统一要求字面 `+` 必须走 `%2B`
