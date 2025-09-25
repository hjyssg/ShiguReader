
<h1 align="center">ShiguReader Backend</h1>

后端分支 仅供开发人员  

##### 开发流程
    etc\sync_frontend_assets_to_backend.py 会先执行 `npm run build`，然后把前端分支生成的 dist 和共享模块复制到此处作为静态文件去 serve。
 
    前端开发时，前端用webpack dev server来自己serve静态文件。   
    比如，前端用9000的端口，后端用3000的端口。用户打开localhost:9000，所有api call都转发到3000端口上的。9000就是webpack dev server。    

    后端开发用vscode打开，然后launch main server。  
    

##### 发布流程：
    安装pkg   (虽然原版pkg不维护，但有开源组织继续维护 https://github.com/yao-pkg/pkg 感谢)
    生成exe    pkg . --compress GZip  
    前端是webpack的打包  
    添加其他文件   
    pkg_zip_tool.py打包成zip。 注意检查不要放自己的信息。    
    具体还可以参考pkg_readme


##### 参数:  
--port：这个参数用来设置软件监听的端口号，您可以通过命令行输入 "--port=端口号" 来指定。  
例如：$ node ShiguReader.exe --port=3000  

--skip-scan：这个参数可以让您跳过应用程序启动时的扫描过程，加快应用程序启动速度。如果您不希望应用程序进行扫描，请在命令行中输入 "--skip-scan" 参数。  
例如：$ node ShiguReader.exe --skip-scan  



##### 数据迁移方法
旧项目中的 `thumbnails` 文件夹和 `workspace/shigureader_internal_db.sqlite` 数据库复制到新的后端就行