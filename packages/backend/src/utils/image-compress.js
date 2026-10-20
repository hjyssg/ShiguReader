// const fs = require('fs');
// const path = require('path');
const util = require('../../../common/src/util');
const execa = require('./own-execa');
const pathUtil = require("./path-util");
const imageMagick = require("../services/image-magick");
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
                //-auto-orient：先按EXIF Orientation把像素转正。-thumbnail会丢弃EXIF信息，不先转正的话，相机竖拍的照片会横躺90度
                const opt = [inputFilePath, "-auto-orient", "-thumbnail", `${height}x${height}\>`, "-quality", "92",  outputFilePath];
                let { stdout, stderr } = await execa(imageMagick.getMagickCmd(), opt);
                if (stderr) {
                    throw stderr;
                }
                result = outputFilePath;
            } 
            
            if (!(await isFileLargerThan1KB(result)) && global.sharp) {
                //sharp输出默认丢弃EXIF（含Orientation），必须显式rotate()把方向写入像素
                await global.sharp(inputFilePath).rotate().resize({ height }).toFile(outputFilePath);
                result = outputFilePath;
            }  
            
            if (!(await isFileLargerThan1KB(result)) && Jimp && height < 300){
                // jimp因为是pure js，性能和输出质量比较差。作为最终替代
                const image = await Jimp.read(inputFilePath);
                await image.resize(Jimp.AUTO, height, Jimp.RESIZE_NEAREST_NEIGHBOR).quality(60).writeAsync(outputFilePath);
            }

            let end1 = getCurrentTime();
            // logger.info(`[doMinifyImage] ${(end1 - beg) }ms `);

            if(!(await isFileLargerThan1KB(result))){
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
