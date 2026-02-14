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
