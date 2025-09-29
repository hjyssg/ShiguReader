# Bundled ffmpeg binary

为了方便 Windows 用户使用内置的 gif 预览生成功能，我们在 `resource/ffmpeg` 目录预留了 `ffmpeg.exe` 可执行文件的位置。

请从官方渠道下载对应版本的 ffmpeg 静态编译包，将其中的 `ffmpeg.exe` 复制到本目录下即可。程序会在启动时自动检测并调用该文件；若未找到则会提示缺少 ffmpeg，并跳过 GIF 缩略图生成。
