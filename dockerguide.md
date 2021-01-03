# Docker使用说明

## 与Windows版本的区别


1. path-config.ini 中的文件路径被修改为了
> /data

这是docker volume 挂载容器内以后的路径。

2. 因为不支持自定义输出目录，所以图包压缩和文件夹打包这两个功能需要手动下载到本地。否则文件会随着程序更新被docker删除。

## 运行方式
> docker run  -p 3000:3000 -v /path/to/comic:/data -d liwufan/shigureader

- 3000 是默认端口，可以修改为3001:3000 3002:3000 3003:3000 等等
- /path/to/comic 是漫画保存的目录



Q：如何更新到最新镜像？

A：镜像分两个分支
- latest 是根据 [推送版本](https://github.com/hjyssg/ShiguReader/releases) 手动更新的，更新时间不定
- nightly 是每晚合并最新代码自动生成的
使用命令下载新版本
> docker pull liwufan/shigureader:nightly

