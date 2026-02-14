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


note： 代码注释用中文