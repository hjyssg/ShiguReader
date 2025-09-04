# ShiguReader

![icon](screenshot/favicon-96x96.png)

[![Latest Release](https://img.shields.io/github/v/release/hjyssg/ShiguReader?label=latest%20release)](https://github.com/hjyssg/ShiguReader/releases)

[English Version](README_English.md)

ShiguReader是一款可在电脑或iPad上使用的漫画浏览器，它还支持整理资源、播放音乐和观看视频等功能。下载 [Release](https://github.com/hjyssg/ShiguReader/releases) 后便可立即开始使用。

## 文档

- [使用说明](Readme_Usage.md)
- [开发环境设置](Readme_Dev_Setup.md)

## 截图

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-02.5](screenshot/02.5.png)
![screenshot-03](screenshot/03.png)
![screenshot-04](screenshot/04.png)
![screenshot-05](screenshot/05.png)
![screenshot-06](screenshot/06.png)

## 功能特色

- 可在电脑和iPad上使用
- 显示每个漫画压缩包的封面，方便浏览
- 支持播放音乐和视频
- 提供各种排序和筛选功能，包括根据喜欢排序
- 可一键压缩压缩包内的图片，节约硬盘空间
- 进行特定作者或同人类型的全部文件展示
- 可移动、删除文件
- 可制作统计图表，统计文件大小和各时期的文件数量
- 接近于旧版熊猫网的配色，让你感受亲切熟悉
- 同时支持Windows和Linux系统

## 支持的文件格式

支持的压缩包格式取决于7Zip。支持常见的zip、rar、7z。图片、音乐和视频的支持格式取决于浏览器。图片格式常见的包括jpg、png和gif，视频格式常见的包括mp4和avi，音乐格式支持mp3和wav等多种格式。

## 演示视频

- [iPad使用](https://www.bilibili.com/video/BV1Mt4y1m7qU)
- [PC使用](https://www.bilibili.com/video/BV1t64y1u729/)
- [iPhone使用](https://www.bilibili.com/video/BV1xt4y1U73L/)

## 快捷键

**漫画页面**

- `Enter`: 全屏
- `A` / `D` 或左右方向键: 翻页
- `W` / `S` 或上下方向键: 上下
- `+` 和 `-`: 缩放图片
- `x`: 移动到 no good 文件夹
- `v`: 移动到 good 文件夹
- `g`: 快速跳页

## 第三方依赖

Linux系统强烈建议安装 [ImageMagick](https://imagemagick.org)。这样可以使用它来压缩图片，提高软件的性能。

## 注意事项

部分文件名带汉字或日语假名的图片无法正常加载，你可能需要进行以下语言设置。请注意，这可能会导致其他非Unicode软件出现乱码问题。

Windows 语言设置如下所示：

![Unicode Setting](screenshot/unicode-setting.png)

## 压缩包内图片压缩功能

[介绍视频](https://www.bilibili.com/video/BV1pi4y147Gu?from=search&seid=13429520178852889848/)

一些漫画图片过于庞大，比如下载了一本24页共640MB的漫画，但关键画面与一本仅30MB的漫画并没有太大区别。因此，我们添加了压缩包内图片压缩功能。首先，你需要确认是否可以通过cmd运行magick命令。然后就可以通过网页以启动压缩程序，压缩后的文件默认保存在 `workspace\\minified_zip_cache` 目录里。

## 配合TamperMonkey使用

把 `EhentaiHighighliger.js` 添加到 TamperMonkey。在你上绅士网的时候，该脚本会与后端服务器通信，显示文件下载过与否。

## FAQ

**问：** 点击 exe 后软件无法启动，怎么办？  
**答：** 默认的 3000 端口可能已被占用，请尝试更改端口号。例如 `ShiguReader_Backend.exe --port 5000`。

**问：** 某些视频无法播放，怎么办？  
**答：** 视频只是附件功能，支持的格式有限。

**问：** 电脑可以正常使用，但是扫描二维码后无法在手机上打开，请问如何解决？  
**答：** 请首先确认电脑和手机是否在同一局域网 Wi-Fi 下。如果仍然无法打开，请检查电脑防火墙设置。

**问：** ShiguReader 是啥意思？  
**答：** Shigure(しぐれ) + Reader。当年的舰C的同人可真好看。

## 反馈与建议

如果你仍有疑问或者需要帮助，请在 Github 上反馈 issue。同时，我们也欢迎任何关于改善 ShiguReader 的建议。

