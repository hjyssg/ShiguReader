# 已完成（Done）

## Task 1：文件系统能力补充（2026-02-14）

* 在已有"移动 / 删除 / 压缩"的基础上，新增：
* POST /api/v1/fs/rename - 重命名文件/文件夹
* GET /api/v1/fs/download - 下载单个文件
* POST /api/v1/fs/unzip - 解压压缩包（保持目录结构）


* 完整的单元测试覆盖（6个测试全部通过）
* 遵循 TDD 开发流程
* 前端 API 客户端已更新
* 状态：done（后端完成，前端 UI 集成待需要时添加）

---

## Task 2：推荐度（Recommendation Score）

* 后端基于 author/tag 频率计算推荐度
* 支持排序、可复现
* 可 SQL 计算，不依赖 ML
* 公式：
* Fa：作者在喜欢目录出现次数
* Ft：标签在喜欢目录出现次数
* Nt：该标签全库总数量
* Score = log(1 + Fa) + log(1 + Ft) * (1 / sqrt(Nt))


* 状态：done（仅后端）

---

## Task 3：重新实现漫画阅读功能（功能类似，不复用代码）

* 参考 BookOverviewPage / BookReadPage / BookWaterfallPage / VideoPlayerPage
* 状态：done

---

## Task 4：清理解压临时文件机制

* 状态：done

---

## Task 5：新增 History 页面

* 状态：done

---

## Task 6：Home 显示电脑硬盘

* 状态：done

---

## Task 7：数据迁移

* 从 backend/thumbnail、shigureader_internal_db.sqlite
* 迁移 history 与 thumbnail 数据
* 状态：done

---

## Task 8：组件重构（2026-02-14）

* 更新开发指南，添加命名约定（Item/Entity/File）
* 移动未使用组件到 .abandon 文件夹
* 重命名 DetailsView → FileTableView
* 重命名 FileList → FileViewContainer
* 为所有组件添加简洁的中文注释（不超过30字）
* 统一命名和代码清理
* 状态：done

---

## Task 9：需要 AI 写一个开发流程

* reader 前几页加载失败
* 可能需要解压到一定程度再加载
* 状态：done

---

## Task 10：忽略系统垃圾文件 / 隐藏文件 / 缓存目录

* 状态：done

---

## Task 11：thumbnail 未找到时用 fingerprint 回查

* 在 IndexRepository 添加 find_thumbnail_by_fingerprint 方法
* 在 ThumbService.get_or_generate 中，缓存未命中时先通过 fingerprint 查询数据库
* 如果找到相同 fingerprint 的文件且其缩略图存在，则复用该缩略图
* 状态：done

---

## Task 12：video 页面与 reader 一致（不显示 footer/header/sidebar）

* 修改 _layout.tsx，将 /video 路径加入 isReaderRoute 判断
* video 页面现在与 reader 页面一样，不显示侧边栏、页眉和页脚
* 状态：done

---

## Task 13：前端重构后 Import 错误修复 ✅

* 将组件从 `.abandon` 文件夹移回 `Common` 文件夹
* Footer.tsx
* ErrorComponent.tsx
* Appearance.tsx
* DataTable.tsx


* 修复所有 import 路径引用
* 状态：已完成

---

## Task 14：解压结构与 Reader / Explorer 重构

* 解压逻辑：
* 按 zip 内部原始目录结构解压（不使用 flat 结构）


* Reader：
* 可直接打开 cache 中的文件
* 支持以 Explorer 模式浏览


* 删除 Reader Overview 页面
* 直接用 Explorer 替代



---

## Task 15：Explorer UI

* 添加 file-change-toolbar-modal
* 要能进行 move、rename、download、move to any folder、move to favorite、解压、打包等操作
* 操作前都要一个 confirm

---

## Task 16：前端重构后 Import 错误修复 ✅（重复修复确认）

* 将组件从 `.abandon` 文件夹移回 `Common` 文件夹
* Footer.tsx
* ErrorComponent.tsx
* Appearance.tsx
* DataTable.tsx


* 修复所有 import 路径引用
* 状态：已完成

---

## Task 17：性能分析与解释

* lsdir 的性能太差，一个 D:_TEMP_DOWNLOADS_ 要 900ms。
* 解释这个 api 的扫描逻辑，查看 sql 请求代码。
* 旧版只要 4ms，对比 hashmap 实现。

---

## Task 18：性能优化

* /api/v1/history/list?page=1&page_size=24&sort_order=desc (300ms)
* /api/v1/tags?page=1&page_size=24&sort_by=count&sort_order=desc (400ms)

---

## Task 19：Setting 控制增强

* FS_ROOTS=D:/_TEMP_DOWNLOADS/,E:/_Happy_Picture
* ALREADY_READ_DIR
* 也需要在 setting 有控制的

---

## Task 20：路径容错处理

* 通过 url 打开页面的时候，当打开实际没有的 filepath 的时候，explorer 和 read 要显示 file 不存在。

---

## Task 21：Search 分页

* search 页面没有分页。这个分页现在前端做就好了。

---

## Task 22：已读文件夹与 Confirm Modal

* env 多加一个已读文件夹。
* Explorer 右键菜单多加一个选项，可以把文件移动到这个文件夹。
* move to favorite 也要 confirm modal。

---

## Task 23：文件夹批量操作

* 给文件夹加一个 dropdown menu 让用户可以给这个文件夹及其子文件夹的文件 thumbnail 缺失、meta 信息的补上。

---

## Task 24：ItemCard 信息增强

* item-card 的 card-info 还需要显示压缩文件的 image number 和 average image size。
* 生成 thumbnail 的时候一并把 meta 信息带过。

---

## Task 25：View Mode 混合模式

* view-mode-controls 增加混合模式：
* folder 和 video 采用简单 filename list 分别两个 section。
* 压缩文件用 grid mode。
* explorer 默认使用这个混合 mode。



---

## Task 26：Archive Tab Title 与加载优化

* archive 没有设置 tab title。
* 解决打开瞬间只解压 10 个文件导致其他图片 broken 的显示问题。

---

## Task 27：Reader 页面布局调整

* reader 的图片占的位置可以大一点，调整 padding 和 max-width。

---

## Task 28：删除确认 Modal 优化

* 文件名太长会 overflow。把 modal 弄宽一点，支持换行。

---

## Task 29：批量插入优化

* favorite 几万个文件时，采用 batch insert。
* 修复 Scan failed: too many values to unpack。

---

## Task 30：Reader Page 操作增强

* 修改 reader page，参考 Explorer，增加各种文件操作 UI。

---

## Task 31：CI/CD

* 每次 push 都需要让 github 运行 action 帮我进行 ut 测试。

---

## Task 32：Setting 编辑器重构

* 文件夹管理改成 editable list。
* 已读目录和收藏编辑：双击进入 edit 模式，点击边上的 save 保存。

---

## Task 33：Reader 信息栏

* 显示文件的相关信息：mtime, size, avg img size, tag, author（点击跳转 search）。

---

## Task 34：性能检查

* 根据 PERFORMANCE_GUIDLINE.md 帮我进行性能检查。

---

## Task 35：打包与运行

* 打包为 exe（同时启动前后端）。
* 更新 launch.json / build 脚本 / README。
* 修复 exe 运行后打不开前端网页的问题。

---

## Task 36：Grid 模式多选

* 用 env 参数先 disable 效果不好的多选功能。

---

## Task 37：右键菜单与 Dropdown 统一

* 加一个下载文件的选项。
* 带 thumbnail 的 item-card 右键菜单改成点击 icon 出现的 dropdown menu。
* 删除点击出现选中状态的逻辑。
* file-item-wrapper 的右键菜单保留。

---

## Task 38：Reader 信息栏修正

* 显示 zip 的视频文件数和音频文件数（大于0则橘色高亮）。
* 检查并修改 avg img size 算法。

---

## Task 39：回收站支持

* 删除支持移到回收站，提供彻底删除和 cancel 选项（后端同步支持）。

---

## Task 40：i18n 补全

* 补全 i18n 支持遗漏部分。

---

## Task 41：Explorer 筛选与排序增强

* 筛选：zip 是否包含 video / audio。
* 排序：按 zip 内 img number。

---

## Task 42：Reader 热键

* v -> 移动喜欢的文件夹。
* x -> 移到已读。

---

## Task 43：推荐排序接入

* 前端接入 recommendation score。
* Explorer 页面添加排序选项。

---

## Task 44：Audio Page 修复

* 修复 audio page 崩溃问题。

---

## Task 45：Video 面包屑修正

* 修复 video 页面 breadcrumb 把 filename 显示了两次的问题。

---

## Task 46：Reader 图片加载占位

* 解决图片加载出来前显示 broken 的问题，优化 extract 接口逻辑。

---

## Task 47：i18n 变量替换 Bug

* 修复 `{count}`, `{size}`, `{fileName}` 等数值没被替换的问题。

---

## Task 48：扫描进度可视化

* 后端 log 文件数。
* 前端 Setting 增加 Tab 查看 scan 进度和 watch 状态。

---

## Task 49：文件状态置信度

* 引入置信度概念（10分钟内 scan/listdir 确认为有效，被 watch 为百分百确定）。
* 影响 search 和各种算法。

---

## Task 50：Windows Explorer 集成

* 支持在系统右键打开文件/文件夹。
* 增加服务器未启动时的空白提示页。

---

## Task 51：UI 语义化与重构

* 重构 Tailwind class 太乱的问题，使 class 清晰，样式移至 CSS。

---

## Task 52：Search 页面增强

* 增加外部搜索 Link (ExHentai / Sukebei)，设计美化。

---

## Task 53：Tag Page 排序

* tag page 的 sort direction 与 explorer 统一。

---

## Task 54：PathBreadcrumb 优化

* 增加 title attribute。
* 最后一个 filename 点击行为统一为点击即复制。

---

## Task 55：History 样式复用

* history 的 fileitem 复用 explorer 样式，显示 thumbnail、文件名、上次阅读时间。

---

## Task 56：Table 组件化

* 抽出共通 table component，保证 explorer 和 history 样式统一。

---

## Task 57：Home 常用文件夹统计

* 基于 folder_open_history 统计 90 天内数据。
* 使用时间衰减算法计算 open_score。

---

## Task 58：Move to Favorite 命名优化

* 追加选项：默认移动到子文件夹（如 good_2026_02_01）。

---

## Task 59：自动重定位移动后的文件

* Reader 打开文件若被移动，通过 fingerprint 自动跳转到新位置。

---

## Task 60：FS.PY 根目录算法重构

* 抽象独立模块，增加 UT，避免扫描无效根目录（如 C 盘）。

---

## Task 61：Link 导航替换

* 尽量用 `<link>` 替换 button click，支持“新标签页打开”。
* 修复 reader 右上角及 history table 的跳转。

---

## Task 62：Explorer 分页与排序

* 追加 pagination。
* 支持按 img num 排序。

---

## Task 63：API 性能优化

* 优化 `/api/v1/fs/list` 在 9000 个文件时的卡顿。

---

## Task 64：Modal 交互修复

* move 确认 modal 确认按钮 auto focus，支持回车确认。

---

## Task 65：Hook 调用修正

* 修复 `useFileOperations.ts` 和 `useResolveMovedFile.ts` 中 axis/layout 调用的问题。

---

## Task 66：Smart Suggestion

* move 文件夹目的地支持基于历史记录的智能建议。

---

## Task 67：UI 响应延迟修复

* 修复打勾、打叉、trash button 点击跳出 modal 的卡顿及双击生效问题。

---

## Task 68：代码清理

* 清除 `FileViewContainer.tsx` 中右键菜单的残留代码。

---

## Task 69：活动通知组件

* 增加“最近活动”组件显示扫描/清除 table 等后台任务，降低用户焦虑感。

---

## Task 70：FS.PY 重构

* 模块化 fs.py 巨无霸模块。

