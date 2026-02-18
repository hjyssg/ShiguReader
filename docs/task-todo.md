# 未完成（Todo / In Progress / Bug）

## Task1：Zip 内大图压缩与再打包
- 参考：D:\Git\ShiguReader\packages
- 对 zip 内过大的图片进行压缩后重新打包 （用户可以在setting设置标准，你参考旧版：D:\Git\ShiguReader\packages）
- 支持选择：
  - 输出到原文件夹
  - 输出到专门目录
- 需要加UT


## Task9：测试补充
- 补充前后端 UT
- 保证所有页面可正常打开（可用 Playwright）


### task
打开带密码的zip
需要前端输出代码 然后去解压或者打开


### task
 archive page和explorer page太像。
 还有没有生成video .move文件的thumbnail


# 针对cosplay图包的优化
  对于压缩包，我们要区分漫画和cosplay图包。nameparser现在主要是日本发行的漫画。
  抽取coser的名字抽取 + 一个coserpage


# task
给代码加上你觉得合适需要的注释
进行你觉得合理应该的重构，保证项目之后还是好维护


## 后端task 
coser pages大面积不是名单里面的coser，而是name parser解析出来的漫画家名字



# task 
  现在内部跳转或者打开新页面缺乏统一管理。你需要进行统一


# task
  前端重构任务： 现在内部跳转或者打开新页面缺乏统一管理。你需要进行统一的url util去管理。
  

# fs.py变成巨无霸了，需要重构一下。
  需要模块化

# home的特殊目录
还需要显示move to favorite的移动子文件夹。（参考move to favorite的modal）

特殊目录
快捷访问文件夹
最常用文件夹
的folder name，都需要title attribute。你写一个内部component。


# UnifiedPagination的分页的时候。
folder和video不分页。在第一页显示全部的folder和video
只针对archives分页

# bug：
api path resolve失败的时候会导致无限loop


# task
frontend\src\routes\_layout\archive.tsx
frontend\src\routes\_layout\read.tsx

文件被移动之后，不要navigate({ to: "/" }) 而是navigate到移动filepath的page

# task
frontend\src\routes\_layout\video.tsx 现在不需要支持audio了，删除对应代码。