// const fs = require('fs');
// const path = require('path');
const util = global.requireUtil();
const execa = require('../utils/own_execa');
const pathUtil = require("../utils/pathUtil");
const logger = require("../config/logger");
const { getCurrentTime } = util;
const Jimp = require('jimp');
const fs = require('fs').promises;

async function isFileLargerThan1KB(filepath) {
    try {
      const stats = await fs.stat(filepath); // 获取文件的状态信息
      return stats.size > 1024; // 1KB = 1024字节
    } catch (error) {
      console.error('Error checking file size:', error);
      return false;
    }
  }

/** 封装sharp和imagick。对图片进行压缩 */
async function doMinifyTempImage(inputFilePath, outputFilePath, height) {
    try {
        if (util.canBeCompressed(inputFilePath)) {
            let beg = getCurrentTime();


            if (await pathUtil.isExist(outputFilePath)) {
                return outputFilePath;
            }

            // unneeded
            // if (!(await pathUtil.isExist(inputFilePath))) {
            //     throw `input file ${inputFilePath} missing`
            // }

            let result;
       
            if (global._has_magick_) {
                //https://imagemagick.org/Usage/resize/#shrink
                const opt = [inputFilePath, "-thumbnail", `${height}x${height}\>`, "-quality", "92",  outputFilePath];
                let { stdout, stderr } = await execa("magick", opt);
                if (stderr) {
                    throw stderr;
                }
                result = outputFilePath;
            } 
            
            if (!isFileLargerThan1KB(result) && global.sharp) {
                await global.sharp(inputFilePath).resize({ height }).toFile(outputFilePath);
                result = outputFilePath;
            }  
            
            if (!isFileLargerThan1KB(result) && Jimp && height < 300){
                // jimp因为是pure js，性能和输出质量比较差。作为最终替代
                const image = await Jimp.read(inputFilePath);
                await image.resize(Jimp.AUTO, height, Jimp.RESIZE_NEAREST_NEIGHBOR).quality(60).writeAsync(outputFilePath);
            }

            let end1 = getCurrentTime();
            // logger.info(`[doMinifyImage] ${(end1 - beg) }ms `);

            if(!isFileLargerThan1KB(result)){
                result = null;
            }

            return result;
        }else {
            console.warn("[doMinifyImage] cannot minify ", inputFilePath)
        }
    } catch (e) {
        logger.error("[doMinifyImage] exception", e);
    }
}

module.exports = {
    doMinifyTempImage
};