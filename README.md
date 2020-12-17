# ShiguReader

[English](https://github.com/hjyssg/ShiguReader/blob/dev/README_English.md)


通过Chrome或者iPad轻松阅读整理漫画，播放音乐，以及观看视频。

##### Screenshot

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-02](screenshot/02.5.png)
![screenshot-03](screenshot/03.png)
![screenshot-04](screenshot/04.png)
![screenshot-05](screenshot/05.png)
![screenshot-06](screenshot/06.png)


##### Demo Video
[iPad使用](https://www.bilibili.com/video/BV1Mt4y1m7qU)  
[PC使用](https://www.bilibili.com/video/BV1t64y1u729/)   
[iPhone使用](https://www.bilibili.com/video/BV1xt4y1U73L/)     

##### Features

* 显示每个漫画zip包的封面,方便阅览。
* 提供各种排序和筛选。比如，C97的文件排在C96的文件之前。
* 一键压缩压缩包内的图片，节约硬盘空间
* 展示特定作者或者同人类型的全部文件。
* 移动删除文件功能。
* 播放压缩包里的音乐文件。
* 播放视频。并显示对应标签。
* 统计图表。统计文件大小，各时期的文件数量。
* 配色和旧版熊猫网的一模一样，亲切熟悉。
* 服务器端支持windows和*nix。
* 客户端支持除IE和Edge的主流浏览器。比如电脑的Chrome和iPad的safari。不需要USB接线，手机不需要安装任何东西，任意浏览器直接可以阅读。
* 直接浏览文件夹的图片

### 支持格式

支持的压缩包取决于[7Zip](https://www.7-zip.org/)。常见的zip、rar、7zi都支持。  
图片、音乐和视频的支持格式取决于浏览器。图片常见的jpg、png、png，视频常见的mp4、avi都是支持的。音乐支持mp3、wav。  
具体可以看src/util.js

### 使用
windows的话，直接下载压缩包解压。
修改ini文件，然后点击ShiguReader.exe
其他系统或者开发者需要参考[Readme_Env_Setup](https://github.com/hjyssg/ShiguReader/blob/dev/Readme_Env_Setup.md)

### 第三方依赖
不安装也没事。但都强烈建议安装
https://imagemagick.org image magick 用来压缩图片的


##### 注意事项
如果部分文件名带汉字日语假名的图片加载不出来，你可能需要如下语言设置。
但有s1坛友反映会导致其他非unicode软件乱码。

windows语言设置:
![unicode setting](screenshot/unicode-setting.png)

##### 安全性
ShiguReader的使用场景是LAN(局域网)，开放到外网非常不安全。
而且功能和性能也是纯粹为家庭用户使用设计的。

##### 压缩包内图片压缩功能

[介绍视频](https://www.bilibili.com/video/BV1pi4y147Gu?from=search&seid=13429520178852889848/)     
现在有的漫画图片明显太大。比如上次下了一本24页640MB，关键画质并没有比1本30MB高出多少。为此添加了压缩包内图片压缩功能。
安装后，自行确认可否在cmd使用magick命令。然后就可以通过网页来启动压缩程序了。
压缩完的文件默认在workspace\image_convert_cache。

##### DOCKER 使用方法
```
docker pull liwufan/shigureader
docker run -d -p hostport:3000 -v comicpath:/data liwufan/shigureader

# hostport 是主机要开放的端口
# comicpath 是要扫描的文件目录
```
有问题阅读 [docker配置说明](https://github.com/hjyssg/ShiguReader/blob/dev/dockerguide.md)


##### NAS 使用方法

[热心人总结的](https://github.com/hjyssg/ShiguReader/issues/90)


##### 和tamper monkey一起使用
    把EhentaiHighighliger.js添加到tamper monkey。
    在你上绅士网的时候，该脚本会通过与后端服务器通信。帮助你知道文件下载过与否。

##### FAQ
    问： 网页能打开, 但是文件夹打开是空的或者404？
    答： 请认真检查path-config.ini的地址有没有写错。

    问： 想问下如果想更新该如何做呢，只要重新克隆一份最新的覆盖就行了？还是说要再走一遍流程?   
    答： 如果是用git的话，拉(pull)最新的代码。重新修改一下用户配置，npm install 最后npm run dev。
         如果没用git，重新走一遍全部流程。  

    问： 默认的端口被占用了，怎么办？
    答:  1.看是不是重复启进程了。  
         2.别的软件已经把端口占了的话，改port-config.js。
    
    问：怎么关闭服务器？
    答：cmd上ctrl+c就好了。或者直接把cmd关了也没事。

    问：电脑可以打开使用，可是手机扫了二维码打不开。怎么办
    答：先确认手机是不是和电脑在同一个局域网下。如果是，还打不开。那可能是电脑防火墙设置问题，自行网上搜索。

##### 热键
漫画页面  
enter: 全屏  
AD和左右方向键: 翻页  
+-: 缩放图片 

##### 认真看这个readme 还是有问题的话
直接在github issue问