README

主服务器，完整服务器
start node src/app.js [port]

副服务器，帮助降低负担 不去监听文件
start node src/subServer.js [port]

src/app.js
    主服务器，完整服务器。包括提供static文件。单独它一个其实就够了。

src/subServer.js
    就提供最低限度的api
