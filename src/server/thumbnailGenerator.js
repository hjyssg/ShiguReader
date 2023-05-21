const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('./own_execa');
const pathUtil = require("./pathUtil");
const logger = require("./logger");
const { getCurrentTime } = util;

/**
 * 用来生成长期储存的thumbnail
 * @param {*} thumbnailFolderPath 存放thumbnail的文件夹
 * @param {*} imgFolderPath 图片所在的文件夹FilePath
 * @param {*} imgFileName  图片的文件名
 * @returns 生成的thumbnail的filepath
 */
async function thumbnailGenerator(thumbnailFolderPath, imgFolderPath, imgFileName) {
    let outputFilePath = null;

    try {
        if (util.canBeCompressed(imgFileName)) {
            let beg = getCurrentTime();

            const outputName = path.basename(imgFolderPath);
            const tempOutputPath = path.resolve(thumbnailFolderPath, outputName) + ".webp";
            const inputFilePath = path.resolve(imgFolderPath, imgFileName);

            if (!(await pathUtil.isExist(inputFilePath))) {
               throw `input file ${inputFilePath} missing`
            }

            if (global._has_magick_) {
                //https://imagemagick.org/Usage/resize/#shrink
                // const opt = [inputFilePath, "-strip", "-resize", `280x354\>`, tempOutputPath];
                const opt = [inputFilePath, "-thumbnail", "250x280\>", "-quality", "92",  tempOutputPath];
                let { stdout, stderr } = await execa("magick", opt);
                if (stderr) {
                    throw stderr;
                }
                outputFilePath = tempOutputPath
            }
            //  else {
            //    // sharp 不能通过pkg打包进去
            //     const sharp = require('sharp');
            //     await sharp(inputFilePath).resize(280, 354).toFile(tempOutputPath);
            //     outputFilePath = tempOutputPath;
            // }

            let end1 = getCurrentTime();
            logger.info(`[thumbnailGenerator] ${(end1 - beg) }ms `);
        }
    } catch (e) {
        logger.error("[thumbnailGenerator] exception", e);
    } finally {
        return outputFilePath;
    }
}

module.exports = thumbnailGenerator;