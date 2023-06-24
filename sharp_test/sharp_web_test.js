// 帮我写一个nodejs性能测试，测试用sharp把图片压缩成jpg的性能

const sharp = require('sharp');
const fs = require('fs');

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
    await sharp(inputFilePath).resize({ height: 1800 }).toFile(outputFilePath);
  }
  const end = new Date();
  console.log(`压缩完成！总共用时 ${end - start} 毫秒`);
}

compress();


// 结论
// 压缩 webp1.5秒 475kb
//      jpg 1.2秒 600kb