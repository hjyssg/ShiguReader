# 未完成（Todo / In Progress / Bug）

## 1. Zip 内大图压缩与再打包

* 参考：`D:\Git\ShiguReader\packages`
* 对 zip 内过大的图片进行压缩后重新打包（用户可以在 setting 设置标准，你参考旧版：`D:\Git\ShiguReader\packages`）
* 支持选择：

  * 输出到原文件夹
  * 输出到专门目录
* 需要加 UT

---

## 2. 测试补充

* 补充前后端 UT
* 保证所有页面可正常打开（可用 Playwright）

### 2.1 打开带密码的 zip

* 需要前端输出代码，然后去解压或者打开
* 低优先级

### 2.2 archive page 和 explorer page 过于相似

* archive page 和 explorer page 太像
* 没有生成 video `.move` 文件的 thumbnail

---

## 3. 针对 cosplay 图包的优化

* 对于压缩包，需要区分漫画和 cosplay 图包
* name parser 现在主要针对日本发行的漫画
* 抽取 coser 名字
* 增加一个 coser page

---

## 4. 代码维护优化

* 给代码加上合适且必要的注释
* 进行合理重构，保证项目后续易维护

---

## 5. 后端优化

* coser pages 大面积不是名单中的 coser，而是 name parser 解析出来的漫画家名字

---

## 6. 前端跳转统一管理

* 现在内部跳转或打开新页面缺乏统一管理，需要进行统一

---

## 7. 前端 URL 管理重构

* 前端重构任务：

  * 现在内部跳转或打开新页面缺乏统一管理
  * 需要使用统一的 URL util 进行管理

