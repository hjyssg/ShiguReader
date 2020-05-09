# Docker指南

## 修改 src/path-config

把 path-config 的路径修改为
> /data

## 设置 src/user-config.js 整理文件的路径
这是镜像中使用的默认配置，可以按照实际情况修改路径
```
const fd =  [y, mm, "01"].join("_");
module.exports.good_folder = "/data/good/"
module.exports.good_folder_root = "/data/good"
module.exports.not_good_folder = "/data/sort/"+ y;
module.exports.additional_folder = [
	"/data/other"
];
```

## 制作镜像
用 --build-arg http_proxy=http://[ip]:[port] 设置网络代理可以加快打包速度

> docker build -t 自定义镜像 .

> docker run -d -p 3000:3000 -v comicpath:/data 自定义镜像


## Q&A
    Q：我想直接拉取镜像，再修改文件怎么办？
    A：docker exec 容器id bash，用文本编辑器修改 /usr/src/app 里的配置文件
