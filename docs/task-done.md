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

旧版的 D:\Git\ShiguReader
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


## Task8：打包与运行
- 打包为 exe（同时启动前后端）
- 更新 launch.json / build 脚本 / README
- 修复：exe 运行后打不开前端网页
  情况现在能打包成exe，但打开会exe失败。


# task 
grid模式下的多选先用env的参数disable。效果不好

# task
右键菜单
加一个下载文件的选项，folder不需要下载。后端api应该已经实现好了。

带thumbnail的item-card的右键菜单也改成 点击icon出现的dropdown menu。
点击出现选中状态的逻辑也删掉。

file-item-wrapper的右键菜单保留

# task：
带thumbnail的item-card的右键菜单没删除。
点击出现选中状态的逻辑也没删掉。

# read page
下面的info bar
还需要显示zip的视频文件数和音频文件数。大于0的话，要用好看的橘色高亮。
你先在计算avg img size的算法你检查一下是不是file size/img num，如果是的话，需要修改。应该要改后端。


## task
现在删除是彻底删除。
你要支持移到回收站。点开三个选项，默认回收站。
然后是彻底删除和cancel
你后端也需要支持。

## Task7：i18n
- 补全 i18n 支持遗漏部分


## Task4：Explorer 筛选与排序增强
- 筛选：
  - zip 是否包含 video
  - zip 是否包含 audio
- 排序：
  - 按 zip 内 img number
- 完成设计与实现


---
# 给reader page的文件操作加热键
v -》 移动喜欢的文件夹
x -》 移到已读


## Task5：推荐排序接入
- 前端接入 recommendation score
- Explorer 页面添加排序选项



## Task6：Audio Page
- 修复 audio page 崩溃问题


# Task
  video 页面的breadcrumb把filename显示了两次
# Task
  reader的图片在加载出来前会显示broken。是因为反复确认图片存在与否吗。感觉api/v1/fs/archive/extract，可以在第一张图存在后再返回（但你要思考没图的时候怎么办）

# Task
i18的bug
    "cacheClearedDetail": "Deleted {count} files, freed {size}",
        "fileNotFoundMessage": "Cannot find file: {fileName}",
    "loadErrorMessage": "Error loading file: {errorMessage}",
  显示的{}的数值没被替换，因为没做空值处理吗


# task
scan including subfodler
scan and watch subfolders的时候看不到进度。

1 后端至少要看到log 文件数
2 希望前端能在setting看到scan进度和整个watch的folder。
  setting的用tab。一个tab是原来的setting。
  第二格tab是现在这些东西。





# task
文件的status状态 引入置信度的概念
scan/listdir 10分钟以外 应该不确定
刚刚被scan/listdir 10分钟内 应该在
被scan/watch 百分百确定

这个要影响到search和各种算法。你打算怎么处理
我也不是没事就去扫描所有文件夹。

有的文件夹从来不改变，给出好方
案。我有一个想法是search画面给出选项，search的时候是只看watched还是被scan过得，scan的失效之类的。





# task
想在windows的file explorer可以右键
打开文件、文件夹

打开的时候，如果前端服务器没启动。我想要有youtube那种空白页面说服务器没启动。

效果不好


## task
explorer和他使用ui的需要语义化，class需要清晰。
现在太多tailwind，看的很累。你进行重构，每个重要div的class都要简单。效果你在css写。


## 前端task
search页面需要加一个link，点下去可以open in a new tab。

https://exhentai.org/?f_search={刚才的搜索词}
https://sukebei.nyaa.si/?f=0&c=0_0&q={刚才的搜索词}

你想一下怎么设计好看


## 前端task
tag page的sort direction要和explorer页面的一样。考虑用共通component 

## frontend\src\components\Common\PathBreadcrumb.tsx
里面能被省略的label全部都要带title attribute

### 前端task
breadcrumb 的最后一个filename/foldername点击下去行为不统一
统一成点击下去 等于 ctrl + c filename/foldername


### 前端task
history的fileitem要复用和其他explorer一样的style。不要用button。
显示thumbnail和filename和上次阅读时间。


### 前端task
table抽出共通
你要实现一个table component。
保证exploer和history的table样式是一样，只是列不一样而已。
我觉得history的table比较好看



## task
  home需要显示最常用的文件夹
  根据folder_open_history
    给你一个**极简但信息完整**的 prompt，直接丢给 AI 生成代码即可：

     要求：
     1. 只统计最近 90 天的数据。
     2. 使用时间衰减算法：
        open_score = sum(exp(-(now - opened_at_ts) / tau))
     3. tau = 14 天（秒）。
     4. 按 open_score 降序排序。
     5. 返回 folder_id 列表。
     6. 使用一条 SQL 完成聚合（SQLite）。
     7. 性能要考虑索引建议。



# task
  move to favorite：
  追加选项。
  默认选项是 移动到喜欢文件夹下面的子文件夹。子文件夹如果没有就mkdir
  命名比如 good_2026_02_01 


# task：
  打开reader，以及其他reader变种的时候，如果这个文件被移动走了。但是filetable能找到这个文件的最新位置（通过print判断）。并且在一个path.esixt彻底确定这个文件存在。直接跳转到新path。

  需要测试

# 后端
  FS.PY 的寻找根目录算法

            db_map: dict[str, tuple[int, int, int]] = {fp: (int(size), int(mtime), int(scan_state)) for fp, size, mtime, scan_state in db_rows}
            root_dirs = _derive_minimal_root_dirs(db_map.keys())
            allowed_roots = _collect_allowed_sync_roots()

            filtered_roots: list[Path] = []
            for root_dir in root_dirs:
                if _is_filesystem_root(root_dir):
                    logger.warning("[file-sync] skip filesystem root directory: %s", root_dir)
                    continue

                if allowed_roots and not any(root_dir == ar or root_dir.is_relative_to(ar) for ar in allowed_roots):
                    logger.info("[file-sync] skip root outside allowlist: %s", root_dir)
                    continue

                filtered_roots.append(root_dir)

            root_dirs = filtered_roots

  应该抽象一个独立模块。拥有很好的ut
  要避免出现c盘这种扫描根目录，同时还要保证所有的文件都扫描到。
  不應該算出来然后去过滤，应该在算的过程中就考虑不可以读取的。


# 前端
  比起用button click去navigate，我更喜欢<link>。这样用户才可以open in a tab or navigate

  reader右上角的explorer和waterfall要替换成link
  history的table view也要是link，才可以左键跳转。ctrl+左键open in a new tab。

  你看看还有哪些button click去navigate的，都尽量去修复。
  注意不能是<link onCLick=>  否则我就取消订阅


  
# explorer
  需要追加pagination
  需要能根据img num进行sort


# explorer page
  /api/v1/fs/list 在文件 9000个的时候会卡。进行优化


# bug
    move的确认modal的确认button需要auto focus？用户按回车才能确认
   而不是toggle fullscreen
