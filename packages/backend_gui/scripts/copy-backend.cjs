#!/usr/bin/env node
const path = require('path');
const fs = require('fs-extra');

async function main() {
  const projectRoot = path.resolve(__dirname, '..');
  const backendSource = path.resolve(projectRoot, '..', 'backend');
  const targetDir = path.resolve(projectRoot, 'dist', 'backend');
  await fs.remove(targetDir);
  await fs.mkdirp(targetDir);
  await fs.copy(backendSource, targetDir, {
    filter: (src) => !src.includes('node_modules')
  });
  console.log('[copy-backend] Copied backend to dist/backend');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
