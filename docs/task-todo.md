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



### 打开带密码的zip
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

列出实现计划，最后要有四个commit。


### 现在这个项目很多UI因为没有实现定义共通，经常出现重复时候和行为样式不一样。需要重构


# history的fileitem要复用和其他explorer一样的style。不要用button。
显示thumbnail和filename和上次阅读时间。


# table抽出共通
你要实现一个table component。
保证exploer和history的table样式是一样，只是列不一样而已。
我觉得history的table比较好看