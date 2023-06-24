// const fs = require('fs');
// const path = require('path');
const util = global.requireUtil();
const execa = require('./own_execa');
const pathUtil = require("./pathUtil");
const logger = require("./logger");
const { getCurrentTime } = util;

/** 封装sharp和imagick */
async function doMinifyImage(inputFilePath, outputFilePath, height) {
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
            if (global.sharp) {
                await global.sharp(inputFilePath).resize({ height }).toFile(outputFilePath);
                result = outputFilePath;
            } else  if (global._has_magick_) {
                //https://imagemagick.org/Usage/resize/#shrink
                const opt = [inputFilePath, "-thumbnail", `${height}x${height}\>`, "-quality", "92",  outputFilePath];
                let { stdout, stderr } = await execa("magick", opt);
                if (stderr) {
                    throw stderr;
                }
                result = outputFilePath;
            }
            let end1 = getCurrentTime();
            logger.info(`[doMinifyImage] ${(end1 - beg) }ms `);

            return result;
        }
    } catch (e) {
        logger.error("[doMinifyImage] exception", e);
    }
}

module.exports = {
    doMinifyImage
};