# Read 页面

阅读器页面（`/read`）是 ShiguReader 的核心浏览入口，支持四种显示模式，通过 URL search param `mode` 切换：

- **gallery**（默认）：单张图片浏览，支持缩放、旋转、拖拽平移、键盘翻页，底部展示文件元信息（作者、coser、标签等）。
- **audio**：音频播放模式，展示封面 + 音轨列表 + 播放器。当压缩包含音频文件时自动进入。
- **mobile**：移动端 Lightbox 全屏滑动浏览，基于 yet-another-react-lightbox。
- **waterfall**：瀑布流纵向排列所有图片，适合快速预览整个压缩包内容。

数据来源分两种：`source=archive`（压缩包解压）和 `source=folder`（文件夹直读）。页面统一处理解压状态轮询、图片预加载、阅读历史记录、文件操作（重命名/移动/删除/收藏/压缩）等逻辑。

文件结构：
```
routes/_layout/read/
  index.tsx            — 主路由，gallery 模式 + mode 分发
  -AudioModeView.tsx   — audio 模式组件
  -MobileModeView.tsx  — mobile 模式组件
  -WaterfallModeView.tsx — waterfall 模式组件
  -types.ts            — 共享类型（ImageEntry, AudioTrack, ReadMode）
  read.css             — 样式
```
