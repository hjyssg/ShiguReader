
<h1 align="center">ShiguReader Backend</h1>

后端分支 仅供开发人员

开发流程
    前端分支 npm build 生成的dist。复制到此处作为静态文件去serve。   
 
    前端开发时，前端用webpack dev server来自己serve静态文件。  
    比如，前端用9000的端口，后端用3000的端口。用户打开localhost:9000，所有api call都转发到3000端口上的。9000就是webpack dev server。  

    后端开发用vscode打开，然后launch main server。
    

发布流程：
    安装pkg 
    生成exe    pkg . --compress GZip
    前端是webpack的打包
    添加其他文件 
    pkg_zip_tool.py打包成zip。 注意检查不要放自己的信息。 


