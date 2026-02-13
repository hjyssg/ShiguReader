task1：
后端实现以下文件系统相关 API，并补充单元测试（UT）：

* 移动文件
* 移动文件夹
* 删除文件 / 文件夹
* 将指定文件夹压缩为 zip

要求：

* 提供清晰的接口定义（RESTful）
* 处理异常情况（不存在、权限不足、路径非法等）
* 覆盖核心逻辑的单元测试

task2：

用户会在 `.env` 中配置一个“喜欢文件”的目录路径（favorite directory path）。

你需要：

1. 基于文件的 `author` 和 `tag`，设计一个简单且可解释的数学公式，计算每个文件的「推荐度 score」
2. 推荐度应基于：

   * 用户喜欢目录中出现过的 author 频率
   * 用户喜欢目录中出现过的 tag 频率
3. 推荐度必须可排序、可复现

前端要求：

* 在 Explorer 页面中支持按推荐度排序
* 排序方式可与现有排序方式并存


```markdown
# 推荐度公式设计

## 目标

设计一个简单、可解释、可排序的推荐公式，基于：

- 用户喜欢目录中的统计数据
- 作者出现频率
- 标签出现频率
- 标签稀缺性（某个 tag 书很少时，新书应有更高权重）

公式必须可复现、可直接在 SQL 或后端逻辑中实现。

---

## 变量定义

对于每个文件：

Fa = 该文件的 author 在“用户喜欢目录”中出现的次数  
Ft = 该文件的 tag 在“用户喜欢目录”中出现的次数  
Nt = 整个库中该 tag 的总文件数量  

---

## 作者权重

使用对数平滑，避免频率过高导致权重爆炸：

AuthorScore = log(1 + Fa)

特点：
- Fa = 0 → 得分为 0
- Fa 增长时，得分递增但增速逐渐变缓
- 稳定、易解释

---

## 标签权重（偏好 × 稀缺）

定义标签稀缺因子：

ScarcityFactor = 1 / sqrt(Nt)

含义：
- Nt 小（该 tag 书少）→ 稀缺因子大 → 权重提升
- Nt 大（热门 tag）→ 稀缺因子小 → 权重被抑制
- 使用 sqrt 防止过度放大

标签得分：

TagScore = log(1 + Ft) × ScarcityFactor

---

## 最终推荐公式

Score = log(1 + Fa)
      + log(1 + Ft) × (1 / sqrt(Nt))

---

## 公式效果说明

- 用户常收藏的作者 → 排名提升
- 用户常收藏的标签 → 排名提升
- 标签下书籍数量少 → 自动获得加权
- 热门标签 → 自然被压制
- 新书若属于小众标签 → 有更高曝光机会

---

## 可选：更强稀缺增强版本

若希望稀缺标签权重更明显，可改为：

ScarcityFactor = 1 / log(2 + Nt)

则：

Score = log(1 + Fa)
      + log(1 + Ft) × (1 / log(2 + Nt))

---

该公式特点：

- 可解释
- 可排序
- 可直接在 SQL 中计算
- 不依赖机器学习
- 参数简单，易于调节
```

task3：  done
参考
D:\Git\ShiguReader\packages\frontend\src\pages

BookOverviewPage
BookReadPage
BookWaterfallPage
VideoPlayerPage

重新实现现在的阅读漫画功能。
不复用他们的代码只是功能要类似。



task4：
现在怎么清理解压的临时文件。


1 done
reader页面不需要header footer和sidebar。

task 5： done
新增 History 页面。



task 6： done
home要显示电脑硬盘



task6：
数据迁移：
能从D:\Git\ShiguReader\packages\backend\thumbnail
D:\Git\ShiguReader\packages\backend\workspace\shigureader_internal_db.sqlite

把history数据和thumbnail导入到这个项目吗





task 8
给explorer添加
file-change-toolbar-move-modal

bug：
audio page挂了


task7：
这个项目可以打包成exe吗？我想要一个release或者build文件，里面有一个exe 我点击就能启动前后端。就能发不 
你需要更新一个launch.json和build脚本还有readme

task10：
http://localhost:5173/explorer?path= 
path没有的时候，应该显示home

task 9：
i18n

做完一个任务git commit一次。我要出门了


task 11
前端现在还没有用上recommendation score


task 10
不要调用没必要的http://localhost:8000/api/v1/users/me