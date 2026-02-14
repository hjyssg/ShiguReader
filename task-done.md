# 已完成（Done）

## Task1：文件系统能力补充（2026-02-14）
- 在已有"移动 / 删除 / 压缩"的基础上，新增：
  - POST /api/v1/fs/rename - 重命名文件/文件夹
  - GET /api/v1/fs/download - 下载单个文件
  - POST /api/v1/fs/unzip - 解压压缩包（保持目录结构）
- 完整的单元测试覆盖（6个测试全部通过）
- 遵循 TDD 开发流程
- 前端 API 客户端已更新
- 状态：done（后端完成，前端 UI 集成待需要时添加）

---

## Task2：推荐度（Recommendation Score）
- 后端基于 author/tag 频率计算推荐度
- 支持排序、可复现
- 可 SQL 计算，不依赖 ML
- 公式：
  - Fa：作者在喜欢目录出现次数
  - Ft：标签在喜欢目录出现次数
  - Nt：该标签全库总数量
  - Score = log(1 + Fa) + log(1 + Ft) * (1 / sqrt(Nt))
- 状态：done（仅后端）

---

## Task3：重新实现漫画阅读功能（功能类似，不复用代码）
- 参考 BookOverviewPage / BookReadPage / BookWaterfallPage / VideoPlayerPage
- 状态：done

---

## Task4：清理解压临时文件机制
- 状态：done

---

## Task5：新增 History 页面
- 状态：done

---

## Task6：Home 显示电脑硬盘
- 状态：done

---

## Task7：数据迁移
- 从 backend/thumbnail、shigureader_internal_db.sqlite
- 迁移 history 与 thumbnail 数据
- 状态：done

---

## Task11：组件重构（2026-02-14）
- 更新开发指南，添加命名约定（Item/Entity/File）
- 移动未使用组件到 .abandon 文件夹
- 重命名 DetailsView → FileTableView
- 重命名 FileList → FileViewContainer
- 为所有组件添加简洁的中文注释（不超过30字）
- 统一命名和代码清理
- 状态：done

---

## Task14：需要 AI 写一个开发流程
- reader 前几页加载失败
- 可能需要解压到一定程度再加载
- 状态：done

---

## Task15：忽略系统垃圾文件 / 隐藏文件 / 缓存目录
- 状态：done

---

## Task16：thumbnail 未找到时用 fingerprint 回查
- 在 IndexRepository 添加 find_thumbnail_by_fingerprint 方法
- 在 ThumbService.get_or_generate 中，缓存未命中时先通过 fingerprint 查询数据库
- 如果找到相同 fingerprint 的文件且其缩略图存在，则复用该缩略图
- 状态：done

---

## Task17：video 页面与 reader 一致（不显示 footer/header/sidebar）
- 修改 _layout.tsx，将 /video 路径加入 isReaderRoute 判断
- video 页面现在与 reader 页面一样，不显示侧边栏、页眉和页脚
- 状态：done
