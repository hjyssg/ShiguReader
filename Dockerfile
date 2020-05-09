# 基于node:alpine
FROM node:alpine
# 安装 node-sass 需要 python build-base，解压工具 p7zip
RUN apk add --update-cache python build-base p7zip

# js文件存放目录
WORKDIR /usr/src/app

#打包复制js代码
COPY package*.json ./
COPY . .

#安装node依赖
RUN npm install 

# /data 是漫画文件的目录, 也就是 src/path-config 里面设置的路径。 容器需要把主机里的目录挂载到这个路径让程序读取。
# 修改 src/user-config.js 内的 module.exports.good_folder 到 /data 目录下, 比如 /data/good /data/bad
# docker实例，只有权限读取 /data 下挂载的文件
VOLUME /data

#网页端口
EXPOSE 8080
EXPOSE 3000

#启用服务
CMD [ "npm", "run","dev" ]