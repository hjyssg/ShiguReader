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

## Task8：打包与运行
- 打包为 exe（同时启动前后端）
- 更新 launch.json / build 脚本 / README
- 移除 `/api/v1/users/me`
- 修复：exe 运行后打不开前端网页

---

## Task9：测试补充
- 补充前后端 UT
- 保证所有页面可正常打开（可用 Playwright）


# task9 
archive没有设置tab title:
你用参考一下reader。
打开的一瞬间只解压10个文件，其他img都显示broken。刷新一下才有。你怎么解决

## task11：
env多加一个已读文件夹
同时 Explorer 右键菜单 多加一个选项，用户可以把文件移动到这个文件夹。跳一个confirm modal。
move to favorite也要confirm modal。
 

## task 10： 
修改reader page
参考   Explorer
也要各种文件操作。但ui你要设计一下。


## task 11：
通过url打开页面的时候，
当打开实际没有的filepath的时候，explorer和read要显示file 不存在

## task 12：
search 页面没有分页。这个分页现在前端做就好了。

 你作为前端专家 
## task 13
view-mode-controls 需要多加一种，混合模式。
folder和video采用简单filename list 分别两个section
压缩文件用grid mode。
explorer默认使用这个混合mode


## task 14
item-card的card-info还需要显示压缩文件的image number和average image size 。有些文件一开始没有meta信息，你可以在生成thumbnail的时候一并把meta信息带过。因为解压文件的时候能拿到meta信息。



###task1 

FS_ROOTS=D:/_TEMP_DOWNLOADS/,E:/_Happy_Picture
ALREADY_READ_DIR
也需要在setting有控制的


task2：
explorer的默认模型应该是mixed