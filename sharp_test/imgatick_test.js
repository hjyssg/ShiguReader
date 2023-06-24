// 帮我写一个nodejs性能测试，测试用sharp把图片压缩成jpg的性能


import {execa} from 'execa';
// const fs = require('fs');
// const iconv = require('iconv-lite');
/**
 * 
 * @param cmd 回去执行的cmd或者cmd路径
 * @param {*} option cmd参数
 * @returns stdout, stderr
 */
async function _execa(cmd, option){
    // console.assert(arguments.length <= 2);
    // if(global._cmd_encoding === 65001){
        let { stdout, stderr } = await execa(cmd, option, { timeout: 60000 });
        return { stdout, stderr }
    // }else{
    //     try{
    //         let { stdout, stderr } = await _execa(cmd, option, { timeout: 60000, encoding: null, windowsHide: true });
    //         // only support chinese os for now
    //         stdout = iconv.decode(stdout, 'gbk');
    //         stderr = iconv.decode(stderr, 'gbk');
    //         return { stdout, stderr }
    //     }catch (err) {
    //         err.stdout = iconv.decode(err.stdout, 'gbk');
    //         err.stderr = iconv.decode(err.stderr, 'gbk');
    //         throw err;
    //     }
    // }
}



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
    const height = 1800;
    const opt = [inputFilePath, "-thumbnail", `${height}x${height}\>`, "-quality", "92",  outputFilePath];
    let { stdout, stderr } = await _execa("magick", opt);
  }
  const end = new Date();
  console.log(`压缩完成！总共用时 ${end - start} 毫秒`);
}

compress();

// image magick性能
// 性能略逊于 sharp 1.5秒

// ---------------------------------
// execa 7.0 评测 不在兼容commonjs的require
// 性能无明显提升
// 不值得提升
