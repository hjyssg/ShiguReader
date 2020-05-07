# ShiguReader

通过Chrome或者iPad轻松阅读电脑的漫画，以及观看视频。

##### Screenshot

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-03](screenshot/03.png)
![screenshot-04](screenshot/04.png)

##### Demo Video
[iPad使用](https://www.bilibili.com/video/BV1Mt4y1m7qU)  
[PC使用](https://www.bilibili.com/video/BV1t64y1u729/)   
[iPhone使用](https://www.bilibili.com/video/BV1xt4y1U73L/)     

##### Features

* 看电脑文件夹里面每个zip包的封面,方便阅览。
* 把子文件夹的文件都展示在一个页面。
* 提供各种排序和筛选。比如，C97的文件排在C96的文件之前。
* 看特定作者或者同人类型的全部文件。分析这些文件分别在哪些文件夹。
* 提供移动删除文件功能。方便看完删或者移动。
* 全局统计文件大小，各时期的文件数量。
* 支持手机和平板。不需要USB接线，手机不需要安装任何东西，任意浏览器直接可以阅读。
* 播放zip文件里的音乐文件。
* 配色和旧版熊猫网的一模一样，亲切熟悉。
* 服务器端支持windows和*nix。*nix需要用户自己安装7zip，并加到cmd路径下。
* 客户端支持除IE和Edge的主流浏览器。比如电脑的Chrome和iPad的safari。


### 支持格式

支持的压缩包取决于[7Zip](https://www.7-zip.org/)。常见的zip、rar、7zi都支持。
图片和视频的支持格式取决于浏览器。图片常见的jpg、png、png，视频常见的mp4、avi都是支持的。


##### Quick Start

###### 中文

```bash
# 不要跳过下面任何一个步骤

# 没有nodejs,麻烦先安装nodejs https://nodejs.org/

# 把代码clone或者github右上角下载到本地
# 建议所放的硬盘至少还有10GB的空间。因为本程序需要缓存。
git clone https://github.com/hjyssg/ShiguReader

# 手动修改用户文件路径设置
# 用任意文本编辑器手动修改src/path-config和src/user-config.js
# path-config一定需要修改
# user-config.js看情况

## 重要:windows用户必须的额外步骤：
## 因为windows的默认cmd很不好用，用了极有可能启动不了。
## 请前往 https://git-scm.com/ 安装git顺便安装上Git Bash 
## 然后以下命令行都请使用Git Bash 

# 命令行进入文件夹。比如
# cd F:\ShiguReader

# 安装依赖
# 最近gitub可能被墙， 所以用taobao的源。
# install会比较慢，要耐心
npm install --registry=http://registry.npm.taobao.org

# install中途要是node-sass报错
# 看一下issue页面。有解决办法

# 重要：*nix以及Mac用户，需要自己用命令行安装7zip。并添加到cmd的path上。

# 启动服务器
# 会有点慢，差不多一两分钟。耐心
npm run dev

# 打开 cmd显示的地址
# 如果要在iphone ipad等移动设备看漫画，可以直接扫描cmd上面的二维码就可以打开网页了

# 打开网页以后，就可以用了。
# 如果你对页面加载速度不满意，前往Admin页面Pregenerate Thumbnail。可以大幅度提高页面加载速度。

# 如果用了一段时间，缓存占了太多空间。
# 手动去到admin页面点clean cache清除缓存。
# 尽量不要在文件夹直接删掉整个缓存文件夹，那样之前生成的缩略图就全部没了。
```

###### English

```bash
# If you do not have nodejs installed, please go to https://nodejs.org/

# Clone the repository or download
git clone https://github.com/hjyssg/ShiguReader

## change user config
## modify src/path-config  src/user-config.js accoding to your own comic files location

## 2020/03/07
## windows default cmd is not working
## Please use Git Bash 

# Go inside the directory
cd ShiguReader

# Install dependencies
npm install

# Start development server
npm run dev

# open the link shown on the cmd
```

##### 注意事项
当src/user-config.js的module.exports.readable_cache_folder_name = true的时候
你可能需要如下设置。但有s1坛友反映会导致其他非unicode软件乱码。

windows语言设置:
![unicode setting](screenshot/unicode-setting.png)

##### 安全性
ShiguReader的使用场景是LAN(局域网)，开放到外网非常不安全。
而且功能和性能也是纯粹为家庭用户使用设计的。

##### 和tamper monkey一起使用
    把EhentaiHighighliger.js添加到tamper monkey。
    在你上绅士网的时候，该脚本会通过与后端服务器通信。帮助你知道文件下载过与否。

##### FAQ
    问： 网页能打开, 但是文件夹打开是空的或者404？
    答： 请认真检查path-config的地址有没有写错。

    问： 想问下如果想更新该如何做呢，只要重新克隆一份最新的覆盖就行了？还是说要再走一遍流程?   
    答： 如果是用git的话，拉(pull)最新的代码。重新修改一下用户配置，npm install 最后npm run dev。
         如果没用git，重新走一遍全部流程。  

    问： 默认的端口被占用了，怎么办？
    答： 改port-config.js

##### 热键
漫画页面  
enter: 全屏  
AD和左右方向键: 翻页  
+- 缩放  

##### 联系方式
qq 398355565
