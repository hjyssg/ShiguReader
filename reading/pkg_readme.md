
npm install -g pkg
    pkg回去网上下载打包的binary，但gfw内。
    所以我们需要自己去下载放到pkg cache里面
    https://github.com/vercel/pkg/issues/419

下载还要手动改名字
    https://github.com/vercel/pkg/issues/765
    e.g fetched-v14.4.0-win-x64
    
pkg src/server/index.js --targets win-x64  --output ShiguReader.exe

移动asset文件 这样可以避免pkg path的坑
    dist
    public
    resource

x
需要flag
    --production 或者代码build时候就是build
    -》改成开发时候用--dev 平时不用

7zip莫名其妙要移动最上层  
    改F:\ShiguReader\resource\7zip\index.js 

打开onebook会显示404 -> 莫名其妙又没事了

修改exe的icon
    http://www.angusj.com/resourcehacker/
    -》改完exe就打不开了

    curl -X GET http://localhost:8080/api/homePagePath
    成功









 ----------------------
 pkg

 可以自己在代码里面加console.log
 C:\Users\**********\AppData\Roaming\npm\node_modules\pkg\prelude\bootstrap.js

  process.dlopen = function dlopen() {
    const args = cloneArgs(arguments);
    const modulePath = revertMakingLong(args[1]);
    const moduleBaseName = path.basename(modulePath);
    const moduleFolder = path.dirname(modulePath);

    console.log(arguments);
    console.log(modulePath);
    console.log(moduleBaseName);
    console.log(moduleFolder);


package-lock 久了要重新生成，否则会安装一堆莫名其妙没用到的东西
明明没用到axios 却会去安装

现在前后端一个分支，应该拆开简化pkg难度

glob打包就炸了
还炸在glob的依赖
C:\\snapshot\\ShiguReader\\node_modules\\.store\\glob@9.3.5\\node_modules\\path-scurry\\dist\\mjs\\index.js.map