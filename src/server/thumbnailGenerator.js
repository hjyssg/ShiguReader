// const fs = require('fs');
const path = require('path');
const util = global.requireUtil();
const execa = require('./own_execa');
const pathUtil = require("./pathUtil");
const logger = require("./logger");
const { getCurrentTime } = util;
const ImageCompressUtil = require("./ImageCompressUtil");


/**
 * 用来生成长期储存的thumbnail
 * @param {*} thumbnailFolderPath 存放thumbnail的文件夹
 * @param {*} imgFolderPath 图片所在的文件夹FilePath
 * @param {*} imgFileName  图片的文件名
 * @returns 生成的thumbnail的filepath
 */
async function thumbnailGenerator(thumbnailFolderPath, imgFolderPath, imgFileName) {
    // let beg = getCurrentTime();
    const outputName = path.basename(imgFolderPath);
    const tempOutputPath = path.resolve(thumbnailFolderPath, outputName) + ".webp";
    const inputFilePath = path.resolve(imgFolderPath, imgFileName);
    const outputFilePath = await ImageCompressUtil.doMinifyImage(inputFilePath, tempOutputPath, 250);
    // let end1 = getCurrentTime();
    // logger.info(`[thumbnailGenerator] ${(end1 - beg) }ms `);
    return outputFilePath;

}

module.exports = thumbnailGenerator;