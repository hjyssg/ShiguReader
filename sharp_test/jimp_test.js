const Jimp = require('jimp');

// 读取图片文件
const inputFilePath = 'ASMR_005.png';

// 设置输出路径和文件名
const outputFilePath = 'output.webp';

// 压缩次数
const compressTimes = 1;

// 记录开始时间
const start = new Date();

// 压缩图片并保存到本地
async function compress() {
  for (let i = 0; i < compressTimes; i++) {
    const image = await Jimp.read(inputFilePath);

    // 设置压缩参数（质量范围为 0-100）
    const quality = 60;
    await image.resize(Jimp.AUTO, 1800).quality(quality).writeAsync(outputFilePath);


    // await image.resize(Jimp.AUTO, 250).writeAsync(outputFilePath);
  }
  const end = new Date();
  console.log(`压缩完成！总共用时 ${end - start} 毫秒`);
}

compress();

//  webp 1865 毫秒
// jpg 2054 毫秒

// thumbnail
// 1100ms