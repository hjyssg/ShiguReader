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



## task
explorer和他使用ui的需要语义化，class需要清晰。
现在太多tailwind，看的很累。你进行重构，每个重要div的class都要简单。效果你在css写。


# task
文件的status状态 引入置信度的概念
scan/listdir 10分钟以外 应该不确定
刚刚被scan/listdir 10分钟内 应该在
被scan/watch 百分百确定

这个要影响到search和各种算法。你打算怎么处理
我也不是没事就去扫描所有文件夹。

有的文件夹从来不改变，给出好方
案。我有一个想法是search画面给出选项，search的时候是只看watched还是被scan过得，scan的失效之类的。