### 1) 后端 UT 怎么运行
你在项目根目录（`d:/Git/Shigureader-vibecode`）执行：

```bash
npm test --prefix backend
```

这是“跑后端全部测试”。

如果只想跑一个文件（更快）：
```bash
npx vitest run backend/tests/routes/fs.test.ts
```

如果想边改边自动重跑：
```bash
npm run test:watch --prefix backend
```

---

### 2) 后端现在 UT 是不是真用 SQLite？
结论：**是，部分测试是真 SQLite，部分是 mock（假的）。**

- `backend/tests/integration/api.integration.test.ts` 这类 **integration 测试**：
  - 用 `initDb(dbPath)` 创建临时 `test.db`
  - 每个用例前后会创建/清理
  - 这是**真实 SQLite 测试**

- `backend/tests/routes/*.test.ts` 这类很多 **route 单测**：
  - 会 mock 掉数据库层（不连真实 DB）
  - 这是**假数据库（mock）测试**

所以你可以理解为：
**项目是“混合测试策略”**——核心流程用真实 SQLite 保真，接口单测用 mock 保速度。