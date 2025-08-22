
<h1 align="center">ShiguReader Backend</h1>

后端分支 仅供开发人员  

##### 开发流程
    前端分支 npm build 生成的dist。复制到此处作为静态文件去serve。   
    etc\sync_common_from_front.py
 
    前端开发时，前端用webpack dev server来自己serve静态文件。   
    比如，前端用9000的端口，后端用3000的端口。用户打开localhost:9000，所有api call都转发到3000端口上的。9000就是webpack dev server。    

    后端开发用vscode打开，然后launch main server。  
    

##### 打包与分发 (命令行版)
本项目现在采用包含便携版Node.js的源码打包方式进行分发，取代了原有的 `pkg` 打包流程。

详细的打包步骤请参考 [INSTRUCTIONS_for_packaging.md](./INSTRUCTIONS_for_packaging.md)。

面向最终用户的安装和使用说明，请参考 [README_dist.md](./README_dist.md)。

##### 命令行参数:
--port：这个参数用来设置软件监听的端口号。
例如：`node src/server/index.js --port=3000`

--skip-scan：这个参数可以让您跳过应用程序启动时的扫描过程。
例如：`node src/server/index.js --skip-scan`