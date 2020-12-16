npm install -g pkg

平时的步骤
npm run build
node src/server/index.js --production


pkg回去网上下载打包的binary，但gfw内。
所以我们需要自己去下载放到pkg cache里面
https://github.com/vercel/pkg/issues/419

下载还要手动改名字
https://github.com/vercel/pkg/issues/765

e.g fetched-v14.4.0-win-x64

pkg src/server/index.js --targets win-x64  --output ShiguReader.exe

测试后端服务器
curl -X POST http://localhost:8080/api/homePagePath
成功


需要flag
    --production 或者代码build时候就是build
    -》改成开发时候用--dev 平时不用


手动移动asset文件 这样可以避免pkg path的坑
    7zip-lite
    dist
    public
    resource

7zip莫名其妙要移动最上层  
改F:\ShiguReader\resource\7zip\index.js 

打开onebook会显示404 -> 莫名其妙又没事了

修改exe的icon
    http://www.angusj.com/resourcehacker/
    -》改完exe就打不开了




