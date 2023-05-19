README 

主服务器，完整服务器
start node src/server/index.js [port]

副服务器，帮助降低负担 不去监听文件
start node src/server/_sub_server.js [port]

server/index.js
    主服务器，完整服务器。包括提供static文件。单独它一个其实就够了。
    单独后端开发服务器，不提供提供static文件

_sub_server.js 
    就提供最低限度的api