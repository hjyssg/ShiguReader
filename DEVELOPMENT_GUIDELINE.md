# 开发指南

## 核心原则

本项目采用**测试驱动开发（TDD）**：先写测试，再写代码。前后端都必须有测试覆盖。数据库变更必须通过 Alembic 迁移。

## 后端测试

**框架：** pytest + coverage

**运行测试：**
```bash
cd backend
bash scripts/test.sh
```

**编写测试：**
- 测试文件放在 `backend/tests/` 对应目录
- 使用 `pytest.fixture` 和 `TestClient`
- 参考 `backend/tests/api/routes/test_fs.py`

## 前端测试

**框架：** Playwright

**运行测试：**
```bash
cd frontend
npm test              # 运行所有测试
npm run test:ui       # UI 模式
```

**编写测试：**
- 测试文件放在 `frontend/tests/`，命名为 `*.spec.ts`
- 使用 `data-testid` 属性定位元素
- 参考 `frontend/tests/login.spec.ts`

## 数据库迁移

**修改数据库时：**

1. 修改 `backend/app/models.py` 中的模型
2. 生成迁移文件：
```bash
cd backend
alembic revision --autogenerate -m "描述变更内容"
```
3. 检查生成的迁移文件（`backend/app/alembic/versions/`）
4. 应用迁移：
```bash
alembic upgrade head
```

**注意：** 每次数据库变更都必须创建迁移文件，不要直接修改数据库。

### 重要：本项目有两套数据库迁移

- **主业务库（backend/app/alembic）**：使用 `backend/alembic.ini`
- **索引库 index_db（backend/app/index_db/alembic）**：由 `ensure_index_db_initialized()` 驱动

请不要混用两套迁移命令。很多“全部请求失败”问题，实际是迁移跑错库或 revision 链配置错误。

---

### index_db 正确迁移方式（推荐）

```bash
cd /d/Git/Shigureader-vibecode/backend
python -c "from app.index_db.bootstrap import ensure_index_db_initialized; ensure_index_db_initialized(); print('index_db migration done')"
```

说明：
- 该方式会自动构造正确的 Alembic `script_location` 与 `sqlalchemy.url`
- 避免手工写错 `alembic -c ...` 参数导致 `No 'script_location' key found`

---

### 常见故障与排查（必须先看）

1. **`KeyError: 'xxxx'` / revision not present**
   - 原因：新迁移文件的 `down_revision` 写错（写成文件名而非 revision id）
   - 处理：检查 `backend/app/index_db/alembic/versions/*.py` 中 `revision/down_revision` 链是否连续

2. **`No 'script_location' key found in configuration`**
   - 原因：拿错 ini 文件或配置不完整
   - 处理：优先改用 `ensure_index_db_initialized()`，不要手工拼 index_db 的 alembic 命令

3. **Windows Git Bash 路径错误（`cd: d:Git... No such file`）**
   - 原因：在 Git Bash 中使用了 CMD 风格路径
   - 正确写法：`cd /d/Git/Shigureader-vibecode/backend`

4. **主库 alembic 在 SQLite 上报 `ALTER COLUMN` 语法错误**
   - 这是主库迁移兼容性问题，不等于 index_db 失败
   - 若当前任务仅涉及 index_db API（如 `/history` `/tags`），先确认 index_db 迁移成功

---

### 快速健康检查命令

```bash
# 1) 确认 index_db 迁移可执行
cd /d/Git/Shigureader-vibecode/backend
python -c "from app.index_db.bootstrap import ensure_index_db_initialized; ensure_index_db_initialized(); print('OK')"

# 2) 确认关键索引存在
sqlite3 /d/Git/Shigureader-vibecode/data/index.db ".indices file_tags"

# 3) 快速验证关键接口
python - <<'PY'
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
print('health', c.get('/api/v1/utils/health-check/').status_code)
print('history', c.get('/api/v1/history/list?page=1&page_size=24&sort_order=desc').status_code)
print('tags', c.get('/api/v1/tags?page=1&page_size=24&sort_by=count&sort_order=desc').status_code)
PY
```

## TDD 工作流程

1. 编写失败的测试
2. 运行测试，确认失败
3. 编写最少代码使测试通过
4. 运行测试，确认通过
5. 重构代码
6. 重复以上步骤


## 命名约定

**组件命名规范：**
- `Item` = 文件系统项（文件 + 文件夹）
- `Entity` = 业务实体（作者、标签等）
- `File` = 特指文件

## 业务语义约束（Author / Coser）

- `author` 定义为**漫画/二次元作品作者**。
- `coser` 定义为**三次元人物（Coser）**。
- 同一个 zip 图包中，`author` 与 `coser` **互斥**，不会同时出现。
- 后端检索与列表接口必须按角色过滤：
  - 作者页 / 作者检索只看 `role == ""`；
  - Coser 页 / Coser 检索只看 `role == "coser"`。

**组件注释规范：**
- 每个组件文件开头必须添加简洁的中文注释（不超过30字）
- 说明组件用途和使用场景

**示例：**
```tsx
// 文件系统项卡片组件，用于展示文件和文件夹
export function FileItem({ item }: { item: FileSystemItem }) {
  // ...
}
```

## 其他规范

- 代码注释用中文
- 多个功能的时候完成一个功能git commit一次
