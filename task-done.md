# 已完成（Done）

- Task1：后端文件系统 API + 单元测试
  - 移动文件
  - 移动文件夹
  - 删除文件 / 文件夹
  - 文件夹压缩为 zip
  - RESTful + 异常处理 + 覆盖核心逻辑 UT
  - 状态：done

- Task2：推荐度（Recommendation Score）
  - 后端基于 author/tag 频率计算推荐度
  - 支持排序、可复现
  - 可 SQL 计算，不依赖 ML
  - 公式：
    - Fa：作者在喜欢目录出现次数
    - Ft：标签在喜欢目录出现次数
    - Nt：该标签全库总数量
    - Score = log(1 + Fa) + log(1 + Ft) * (1 / sqrt(Nt))
  - 状态：done（仅后端）

- Task3：重新实现漫画阅读功能（功能类似，不复用代码）
  - 参考 BookOverviewPage / BookReadPage / BookWaterfallPage / VideoPlayerPage
  - 状态：done

- Task5：新增 History 页面
  - 状态：done

- Task6：Home 显示电脑硬盘
  - 状态：done

- Task7：数据迁移
  - 从 backend/thumbnail、shigureader_internal_db.sqlite
  - 迁移 history 与 thumbnail 数据
  - 状态：done

- Task14：需要 AI 写一个开发流程
  - 状态：done


- Task14：
  - reader 前几页加载失败
  - 可能需要解压到一定程度再加载
