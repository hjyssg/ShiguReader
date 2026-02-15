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


## Task18：前端重构后 Import 错误修复 ✅
- 将组件从 `.abandon` 文件夹移回 `Common` 文件夹
  - Footer.tsx
  - ErrorComponent.tsx
  - Appearance.tsx
  - DataTable.tsx
- 修复所有 import 路径引用
- 状态：已完成




## Task2：解压结构与 Reader / Explorer 重构
- 解压逻辑：
  - 按 zip 内部原始目录结构解压（不使用 flat 结构）
- Reader：
  - 可直接打开 cache 中的文件
  - 支持以 Explorer 模式浏览
- 删除 Reader Overview 页面
  - 直接用 Explorer 替代

---

## Task3：Explorer UI
- 添加 file-change-toolbar-modal
- 要能进行 move、rename、download、move to any folder、move to favorite、解压、打包等操作
- 操作前都要一个 confirm


## Task10：前端重构后 Import 错误修复 ✅
- 将组件从 `.abandon` 文件夹移回 `Common` 文件夹
  - Footer.tsx
  - ErrorComponent.tsx
  - Appearance.tsx
  - DataTable.tsx
- 修复所有 import 路径引用
- 状态：已完成


task high：
lsdir的性能太差，一个D:\_TEMP_DOWNLOADS\_ 要900ms。
你先给我解释，这个api的扫描是怎么扫描。
sql请求是怎么做的。我要看代码。

旧版的shigureader D:\Git\ShiguReader
api/folder/list_dir 只要4ms。
旧版就一个list folder然后通过hashmap到每个file的信息。


# task
性能优化

/api/v1/history/list?page=1&page_size=24&sort_order=desc
要300ms 太慢


/api/v1/tags?page=1&page_size=24&sort_by=count&sort_order=desc
要400ms

/api/v1/tags?page=1&page_size=24&sort_by=count&sort_order=desc
要400ms


### task1 

FS_ROOTS=D:/_TEMP_DOWNLOADS/,E:/_Happy_Picture
ALREADY_READ_DIR
也需要在setting有控制的

## task 11：
通过url打开页面的时候，
当打开实际没有的filepath的时候，explorer和read要显示file 不存在

## task 12：
search 页面没有分页。这个分页现在前端做就好了。

## task11：
env多加一个已读文件夹
同时 Explorer 右键菜单 多加一个选项，用户可以把文件移动到这个文件夹。跳一个confirm modal。
move to favorite也要confirm modal。
 
# task
给文件夹加一个dropdown menu 让用户可以给这个文件夹及其子文件夹的文件
thumbnail缺失、meta信息的补上

## task 14
item-card的card-info还需要显示压缩文件的image number和average image size 。有些文件一开始没有meta信息，你可以在生成thumbnail的时候一并把meta信息带过。因为解压文件的时候能拿到meta信息。

## task 13
view-mode-controls 需要多加一种，混合模式。
folder和video采用简单filename list 分别两个section
压缩文件用grid mode。
explorer默认使用这个混合mode


# task9 
archive没有设置tab title:
你用参考一下reader。
打开的一瞬间只解压10个文件，其他img都显示broken。刷新一下才有。你怎么解决


### task2:
reader页面调整：

reader的图片占的位置可以大一点。下面明明很多padding。我看到你舍得max-width。你思考怎么调整。

# task
删除的confrim modal
文件名太长会overflow。你把modal弄宽一点。如果还是超过，就换行

## task15:
现在favorite几万个文件。你看看是不是要拆分开成几批进行batchinsert
Scan failed for E:\_Happy_Lesson\_Going_to_sort\_good: too many values to unpack (expected 1)


## task 10： 
修改reader page
参考   Explorer
也要各种文件操作。但ui你要设计一下。


## task：
  每次push都需要让github运行action帮我进行ut测试


  # setting编辑
  文件夹多个的那个，你要改成一个editable list。
  每个folder path一列，可以remove edit。
  然后最下面一个add new


  已读目录和收藏的编辑应该是平时是一个input + 一个disable的save button。用户双击进入edit模式，修改完。点击边上的save保存。



# reader page要能显示文件的相关信息：
  mtime
  size
  avg img size
  文件的tag author -》点击要能跳转到search

  页面设计你来，好看简单




# task
根据PERFORMANCE_GUIDLINE.md 帮我进行性能检查。 
