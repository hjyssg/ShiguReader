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
# 给reader page的文件操作加热键
v -》 移动喜欢的文件夹
x -》 移到已读

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
文件的status状态

# task
给代码加上你觉得合适需要的注释
进行你觉得合理应该的重构，保证项目之后还是好维护

# task 
grid模式下的多选先用env的参数disable。效果不好

