##### Dev Env Setup
```bash
# 不要跳过下面任何一个步骤

# 没有Node.js 14,麻烦先安装nodejs https://nodejs.org/

# 到 https://imagemagick.org 下载安装image magick。 
# imagemagick是用来压缩图片的。不安装也没事，但强烈建议安装。

# 把代码clone或者github右上角下载到本地
# 建议所放的硬盘至少还有10GB的空间。因为本程序需要缓存。
git clone https://github.com/hjyssg/ShiguReader

# 手动修改用户文件路径设置
# 用任意文本编辑器手动修改path-config.ini和src/config/user-config.js
# path-config.ini一定需要修改
# user-config.js看情况

## 重要:windows用户必须的额外步骤：
## 因为windows的默认cmd很不好用，用了极有可能启动不了。
## 请前往 https://git-scm.com/ 安装git顺便安装上Git Bash 
## 然后以下命令行都请使用Git Bash 

# 命令行进入文件夹。比如
# cd F:\ShiguReader

# 安装依赖
# 如果人在墙外，只需要
npm install 

# 否则因为有依赖包要从github下载，可能会卡住。
# 给出以下几种尝试方式。
# 第1种 指定--registry
npm install --registry=http://registry.npm.taobao.org

# 第2种 使用cnpm
npm install -g cnpm --registry=https://registry.npm.taobao.org
#cmd输入以上命令就可以了，然后输入
cnpm install 

# 第3种 设置registry
npm config set registry https://registry.npm.taobao.org
# 后续的install等命令还是通过npm运作

# 安装成功会显示类似
# added 100 package from 100 contributor in 200s

# 重要：*nix以及Mac用户，需要自己用命令行安装7zip。并添加到cmd的path上。

# 启动服务器
# 会有点慢，差不多一两分钟。耐心
npm run dev

# 打开 cmd显示的地址
# 如果要在iphone ipad等移动设备看漫画，可以直接扫描cmd上面的二维码就可以打开网页了

# 打开网页以后，就可以用了。
# 如果你对页面加载速度不满意，前往Admin页面Pregenerate Thumbnail。可以大幅度提高页面加载速度。强烈推荐。

# 如果用了一段时间，缓存占了太多空间。
# 可以手动去到admin页面点clean cache清除缓存。或者直接删除cache文件夹也没事。
# 重启服务器也会清楚缓存
```