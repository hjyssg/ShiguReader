# ShiguReader

通过Chrome或者iPad轻松阅读本地漫画。

##### Screenshot

![screenshot-01](screenshot/01.png)
![screenshot-02](screenshot/02.png)
![screenshot-03](screenshot/03.png)


##### 怎么运行？
参考 Env_README.md

##### Quick Start

```bash
# Clone the repository
git clone https://github.com/hjyssg/ShiguReader

# Go inside the directory
cd ShiguReader

## change user config
手动修改user-config.js用户文件设置  

# Install dependencies
yarn (or npm install)

# Start development server
yarn dev (or npm run dev)
```

##### clean local cache 定期手动清理解压缩漫画
```bash
npm run clean-cache
```

##### 注意事项
windows语言设置要参考unicode setting.png  
user-config.js修改用户文件设置  

##### 提前生成thumbnail
http://localhost:8080/api/pregenerateThumbnails  
30分钟大约生成10,000个thumbnail

##### 联系方式
qq 398355565
