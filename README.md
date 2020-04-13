# ShiguReader

通过Chrome或者iPad轻松阅读本地漫画。

##### Screenshot

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-03](screenshot/03.png)

##### Demo Video

[iPhone使用](https://www.bilibili.com/video/BV1xt4y1U73L/)
[PC使用](https://www.bilibili.com/video/BV1t64y1u729/)



##### Quick Start

```bash
# DO NOT SKIP ANY STEP BELOW
# 不要跳过下面任何一个步骤

# If you do not have nodejs installed, please go to https://nodejs.org/
# 没有nodejs,麻烦先安装nodejs

# Clone the repository
# 把代码clone或者下载到本地
git clone https://github.com/hjyssg/ShiguReader

## change user config
## 手动修改设置
#用任意文本编辑器手动修改src/user-config.js用户文件设置  
modify src/user-config.js accoding to your own comic files location

## 2020/03/07
## windows default cmd is not working
## Please use Git Bash 

# Go inside the directory
# 命令行进入文件夹
cd ShiguReader

# Install dependencies
# 最近gitub都被墙
# npm install --registry=http://registry.npm.taobao.org
npm install

# Start development server
npm run dev or click run.bat

# open http://localhost:3000/
```

##### 注意事项
windows语言设置:

![unicode setting](screenshot/unicode-setting.png)

##### 热键
漫画页面  
enter: 全屏  
AD和左右方向键: 翻页  
+- 缩放  



##### 联系方式
qq 398355565
