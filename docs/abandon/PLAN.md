# BackendNode 重写计划

## 技术栈
- **框架**: Fastify + TypeScript
- **数据库**: Node.js 原生 `node:sqlite`（Node 22.5+）或 better-sqlite3（UT 验证后决定）
- **校验**: Zod
- **测试**: Vitest

## 目录结构
```
backendnode/
├── src/
│   ├── server.ts           # 入口
│   ├── app.ts              # Fastify 实例 + 插件注册
│   ├── config.ts           # 配置（读 .env）
│   ├── constants.ts        # 文件类型常量
│   ├── db/
│   │   ├── schema.sql      # 建表 SQL
│   │   ├── client.ts       # DB 连接 + 写锁
│   │   └── repository.ts   # 数据访问层
│   ├── routes/
│   │   ├── fs.ts
│   │   ├── search.ts
│   │   ├── tags.ts
│   │   ├── authors.ts
│   │   ├── cosers.ts
│   │   ├── history.ts
│   │   ├── settings.ts
│   │   └── utils.ts
│   ├── services/
│   │   ├── thumbService.ts
│   │   └── scanService.ts
│   └── utils/
│       ├── fileType.ts
│       └── nameParser.ts
├── tests/
│   ├── db/
│   │   ├── sqlite-native.test.ts   # 验证 node:sqlite 可用性
│   │   └── repository.test.ts
│   ├── routes/
│   │   ├── fs.test.ts
│   │   ├── search.test.ts
│   │   └── history.test.ts
│   └── utils/
│       └── fileType.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 进度记录

| 步骤 | 内容 | 状态 | 完成时间 |
|------|------|------|----------|
| 1 | 项目脚手架（package.json / tsconfig / vitest） | ✅ | 2026-02-20 23:45 |
| 2 | constants + config | ⬜ | - |
| 3 | DB schema + client（含 node:sqlite UT 验证） | ⬜ | - |
| 4 | Repository + UT | ⬜ | - |
| 5 | utils/fileType + UT | ⬜ | - |
| 6 | routes/fs + UT | ⬜ | - |
| 7 | routes/history + UT | ⬜ | - |
| 8 | routes/search + UT | ⬜ | - |
| 9 | routes/tags + authors + cosers + UT | ⬜ | - |
| 10 | services/scanService | ⬜ | - |
| 11 | services/thumbService | ⬜ | - |
| 12 | app.ts + server.ts 组装 | ⬜ | - |
