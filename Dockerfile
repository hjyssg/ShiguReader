# 基于node:alpine
FROM node:alpine
# 安装 node-sass 需要 python build-base，解压工具 p7zip
RUN apk add --no-cache python build-base imagemagick p7zip

# js文件存放目录
WORKDIR /usr/src/app
COPY package.json ./

#安装node依赖
RUN npm install 

# /data 是漫画文件的目录, 也就是 path-config.ini 里面设置的路径。 容器需要把主机里的目录挂载到这个路径让程序读取。
# 修改 src/config/user-config.js 内的 module.exports.good_folder 到 /data 目录下, 比如 /data/good /data/bad
# docker实例，只有权限读取 /data 下挂载的文件
VOLUME /data

#网页端口
EXPOSE 3000

#安装程序
COPY . .
RUN mkdir thumbnails cache
RUN chown -R node /usr/src/app
USER node
CMD [ "npm", "run","dev" ]
