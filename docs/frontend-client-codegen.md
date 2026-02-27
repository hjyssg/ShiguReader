# 前端 API Client 代码生成说明

## 概述

`frontend/src/client/` 目录下的所有文件（`types.gen.ts`、`sdk.gen.ts` 等）都是**自动生成的**，不要手动修改。

## 生成链路

```
frontend/openapi.json
        ↓  npm run generate-client
frontend/src/client/
  ├── types.gen.ts   ← 所有请求/响应的 TypeScript 类型
  ├── sdk.gen.ts     ← 封装好的 Service 类（如 SearchService）
  └── schemas.gen.ts ← JSON Schema 定义
```

工具：[@hey-api/openapi-ts](https://heyapi.dev/)，配置在 `frontend/openapi-ts.config.ts`。

## openapi.json 是什么

`frontend/openapi.json` 是前后端的 **API 契约**，描述了所有接口的路径、请求体、响应体和字段类型。

这个文件目前是**手动维护**的（不是从后端自动导出的）。

## 如何更新

当后端新增/修改了接口，或者需要扩展某个字段的合法值时：

1. 修改 `frontend/openapi.json` 中对应的 schema
2. 重新生成 client：

```bash
cd frontend
npm run generate-client
```

3. 提交 `openapi.json` 和 `src/client/` 下的变更

## 示例：扩展 SearchRequest.mode 的合法值

`SearchRequest.mode` 原来只有 `["exact", "fuzzy"]`，添加 `"local-check"` 时需要：

**修改 openapi.json：**
```json
"mode": {
  "type": "string",
  "enum": ["exact", "fuzzy", "local-check"],
  "title": "Mode",
  "default": "fuzzy"
}
```

然后重跑 `npm run generate-client`，`types.gen.ts` 里的类型就会自动更新为：
```ts
mode?: 'exact' | 'fuzzy' | 'local-check';
```

## 注意事项

- `src/client/` 下的文件**不要手动编辑**，下次生成会被覆盖
- 如果后端实际支持某个值但 `openapi.json` 里没有，TypeScript 编译会报类型错误
- `openapi.json` 和后端实际行为需要保持同步，否则会产生运行时错误
