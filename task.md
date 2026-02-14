# 未完成（Todo / In Progress / Bug）

## Task1：Zip 内大图压缩与再打包
- 参考：D:\Git\ShiguReader\packages
- 对 zip 内过大的图片进行压缩后重新打包
- 支持选择：
  - 输出到原文件夹
  - 输出到专门目录
- 需要加UT

---

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

## Task8：打包与运行
- 打包为 exe（同时启动前后端）
- 更新 launch.json / build 脚本 / README
- 移除 `/api/v1/users/me`
- 修复：exe 运行后打不开前端网页

---

## Task9：测试补充
- 补充前后端 UT
- 保证所有页面可正常打开（可用 Playwright）
