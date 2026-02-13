# Task List

## Task1
后端实现文件系统 API + 单元测试：

- 移动文件
- 移动文件夹
- 删除文件/文件夹
- 文件夹压缩为 zip

要求：
- RESTful 接口
- 异常处理（不存在、权限、非法路径）
- 覆盖核心逻辑 UT

状态：done
---

## Task2
用户在 `.env` 配置 favorite directory。

实现：

1. 基于 author / tag 计算推荐度
2. 使用喜欢目录中的 author/tag 频率
3. 支持排序、可复现

前端：
- Explorer 支持按推荐度排序
- 与现有排序并存

状态：前端页面选项没有。

### 推荐公式

变量：
- Fa：作者在喜欢目录出现次数
- Ft：标签在喜欢目录出现次数
- Nt：该标签全库总数量

公式：

Score = log(1 + Fa)  
      + log(1 + Ft) × (1 / sqrt(Nt))

要求：
- 可解释
- 可排序
- 可 SQL 计算
- 不依赖 ML

状态：done

---

## Task3
参考现有页面结构：
- BookOverviewPage
- BookReadPage
- BookWaterfallPage
- VideoPlayerPage

重新实现漫画阅读功能（不复用代码，仅功能类似）。


状态：done
---

## Task4
清理解压临时文件机制。


---

## Task5（done）
新增 History 页面。

状态：done
---

## Task6（done）
Home 显示电脑硬盘。

状态：done
---

## Task7
数据迁移：

从：
- backend/thumbnail
- shigureader_internal_db.sqlite

迁移 history 与 thumbnail 数据到当前项目。

状态：done
---

## Task8
- Explorer 添加 file-change-toolbar-move-modal
- 修复 audio page 崩溃


---

## Task9
i18n 支持。

状态：还有遗漏
---

## Task10
- 打包为 exe（启动前后端）
- 更新 launch.json / build 脚本 / README

- 移除不必要的 `/api/v1/users/me` 请求

状态：运行exe打不开前端网页
---

## Task11
前端接入 recommendation score。

---

## Task12
补充前后端 UT。

---

Note：
每完成一个任务执行一次 git commit。
