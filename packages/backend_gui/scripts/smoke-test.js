#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

async function run() {
  const backendRoot = path.resolve(__dirname, '..', '..', 'backend');
  const entry = path.join(backendRoot, 'src', 'app.js');
  console.log('[smoke] 启动服务...');
  const child = spawn(process.execPath, [entry], {
    cwd: backendRoot,
    env: { ...process.env, PORT: '3100', LOG_LEVEL: 'info' }
  });

  let ready = false;
  child.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    if (text.includes('listening') || text.includes('Server started')) {
      ready = true;
    }
  });

  child.stderr.on('data', (data) => process.stderr.write(data.toString()));

  await waitUntil(() => ready, 15000, 500);
  console.log('[smoke] 健康检查...');
  const resp = await fetch('http://127.0.0.1:3100/health');
  if (!resp.ok) {
    throw new Error(`[smoke] 健康检查失败: ${resp.status}`);
  }
  console.log('[smoke] 健康检查通过，准备停止服务');
  await stopChild(child);
  console.log('[smoke] 服务已停止');
}

async function waitUntil(predicate, timeout, interval) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('等待超时，服务未就绪');
}

async function stopChild(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (child.pid) process.kill(child.pid, 'SIGKILL');
      reject(new Error('服务关闭超时'));
    }, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(undefined);
    });
    child.kill('SIGINT');
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
