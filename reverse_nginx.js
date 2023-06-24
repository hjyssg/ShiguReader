const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');

const app = express();

// // 启动 server.js 和 subserver.js 两个应用程序
// const serverProcess = spawn('node', ['server.js']);
// const subServerProcess = spawn('node', ['subserver.js']);

// // 监听这两个应用程序的输出和错误信息
// serverProcess.stdout.on('data', data => console.log(`server.js: ${data}`));
// serverProcess.stderr.on('data', data => console.error(`server.js: ${data}`));
// subServerProcess.stdout.on('data', data => console.log(`subserver.js: ${data}`));
// subServerProcess.stderr.on('data', data => console.error(`subserver.js: ${data}`));

// 配置反向代理规则
const serverProxy = createProxyMiddleware('/api', {
  target: 'http://localhost:3000',
  changeOrigin: true // 如果目标服务器是虚拟主机，则必须设置为 true
});
const subServerProxy = createProxyMiddleware('/', {
  target: 'http://localhost:34213)',
  changeOrigin: true // 如果目标服务器是虚拟主机，则必须设置为 true
});

// 将反向代理中间件挂载到应用程序上
app.use(serverProxy);
app.use(subServerProxy);

// 启动应用程序
app.listen(8080, () => {
  console.log(`Node.js 反向代理已启动：http://localhost:8080`);
});
