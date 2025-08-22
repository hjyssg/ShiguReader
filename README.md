
<h1 align="center">ShiguReader Backend</h1>

后端分支 仅供开发人员  

##### 开发流程
    前端分支 npm build 生成的dist。复制到此处作为静态文件去serve。   
    etc\sync_common_from_front.py
 
    前端开发时，前端用webpack dev server来自己serve静态文件。   
    比如，前端用9000的端口，后端用3000的端口。用户打开localhost:9000，所有api call都转发到3000端口上的。9000就是webpack dev server。    

    后端开发用vscode打开，然后launch main server。  
    

##### 构建与分发 (Webpack)
本项目的分发包通过 Webpack 进行构建。`src` 目录下的应用源码会被打包成一个单独的 `build/main.js` 文件。

**构建命令:**
```bash
npm run build
```

**打包与分发:**
关于如何将构建产物 (`build/main.js`)、`node_modules`、便携版Node.js运行环境以及其他资源组合成一个可供用户使用的最终分发包，请参考详细的打包指南：
[INSTRUCTIONS_for_packaging.md](./INSTRUCTIONS_for_packaging.md)

**最终用户使用说明:**
最终用户的使用方式请参考 [README_dist.md](./README_dist.md)。


##### 命令行参数:
服务器支持以下命令行参数:
`--port`: 设置监听端口。
`--skip-scan`: 启动时跳过扫描。

**开发时运行:**
`node src/server/index.js --port=3000`

**通过构建产物运行:**
`node build/main.js --port=3000`