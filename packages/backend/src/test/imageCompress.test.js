const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

describe('image-compress', () => {
  let tempDir;

  before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shigu-img-compress-'));
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should bake EXIF orientation into minified image', async () => {
    global.sharp = require('sharp');
    // 测试环境不依赖本机是否安装ImageMagick，强制走sharp分支
    global._has_magick_ = false;
    const imageCompress = require('../utils/image-compress');

    const width = 400;
    const height = 300;
    const inputPath = path.join(tempDir, 'portrait.jpg');
    const outputPath = path.join(tempDir, 'portrait-min.jpg');

    // 造一张带 Orientation=6（顺时针90度）的噪声图，噪声保证压缩后大于1KB
    const raw = Buffer.alloc(width * height * 3);
    for (let ii = 0; ii < raw.length; ii++) {
      raw[ii] = Math.floor(Math.random() * 256);
    }
    await global.sharp(raw, { raw: { width, height, channels: 3 } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(inputPath);

    const result = await imageCompress.doMinifyTempImage(inputPath, outputPath, 200);

    assert.strictEqual(result, outputPath);

    const meta = await global.sharp(outputPath).metadata();
    // sharp输出会丢弃EXIF，方向必须已经写入像素：竖图150x200而不是200x150
    assert.strictEqual(meta.orientation, undefined);
    assert.strictEqual(meta.width, 150);
    assert.strictEqual(meta.height, 200);
  });
});
