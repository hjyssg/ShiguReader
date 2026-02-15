# 未完成（Todo / In Progress / Bug）

## Task1：Zip 内大图压缩与再打包
- 参考：D:\Git\ShiguReader\packages
- 对 zip 内过大的图片进行压缩后重新打包 （用户可以在setting设置标准，你参考旧版：D:\Git\ShiguReader\packages）
- 支持选择：
  - 输出到原文件夹
  - 输出到专门目录
- 需要加UT

---

---

## Task4：Explorer 筛选与排序增强
- 筛选：
  - zip 是否包含 video
  - zip 是否包含 audio
- 排序：
  - 按 zip 内 img number
- 完成设计与实现

---

## Task5：推荐排序接入
- 前端接入 recommendation score
- Explorer 页面添加排序选项

---

## Task6：Audio Page
- 修复 audio page 崩溃问题

---

## Task7：i18n
- 补全 i18n 支持遗漏部分

---


---



---

## Task9：测试补充
- 补充前后端 UT
- 保证所有页面可正常打开（可用 Playwright）




### 打开带密码的zip
需要前端输出代码 然后去解压或者打开



### task
 archive page和explorer page太像。
 还有没有生成video .move文件的thumbnail




# reader page要能显示文件的相关信息：
  mtime
  size
  avg img size
  文件的tag author -》点击要能跳转到search

  页面设计你来，好看简单

# setting编辑
  文件夹多个的那个，你要改成一个editable list。
  每个folder path一列，可以remove edit。
  然后最下面一个add new


  已读目录和收藏的编辑应该是平时是一个input + 一个disable的save button。用户双击进入edit模式，修改完。点击边上的save保存。

# 给reader page的文件操作加热键
v -》 移动喜欢的文件夹
x -》 移到已读

# task
根据PERFORMANCE_GUIDLINE.md 帮我进行性能检查。 


## Task8：打包与运行
- 打包为 exe（同时启动前后端）
- 更新 launch.json / build 脚本 / README
- 修复：exe 运行后打不开前端网页
  情况现在能打包成exe，但打开会exe失败。


