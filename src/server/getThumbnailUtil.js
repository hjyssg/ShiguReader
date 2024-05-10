const path = require('path');
const _ = require('underscore');

const serverUtil = require("./serverUtil");
const util = global.requireUtil();
const { isImage, isCompress, isVideo, isMusic, 
    getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;

const pathUtil = require("./pathUtil");
const { isHiddenFile, generateContentUrl, isExist, filterPathConfig, isSub, estimateIfFolder } = pathUtil;

// DB import
const db = require("./models/db");
const zipInfoDb = require("./models/zipInfoDb");
const thumbnailDb = require("./models/thumbnailDb");
const logger = require("./logger");



/**
 * 找文件夹的thumbnail
 */
async function getThumbnailForFolders(filePathes) {
    const result = {};

    if(!filePathes || filePathes.length == 0){
        return result;
    }
    // TODO 担心nextFilePathe很多的时候

    function findOne(rows, filePath){
        let findRow = null;
        rows.forEach(row => {
            if(!findRow){
                if(isSub(filePath, row.filePath)){
                    findRow = row;
                }
            }
        })
        return findRow;
    }

    try{
        let beg = getCurrentTime();

        // 先尝试从thumbnail db拿
        // Q ask chatgpt: write a sql query that if column 'file' contains one of string array
        const stringsToMatch = filePathes; // string array of values
        const patterns = stringsToMatch.map(str => `${str}%`);
        const placeholders = patterns.map(() => 'filePath LIKE ?').join(' OR ');
        const sql = `
            SELECT *
            FROM thumbnail_table
            WHERE ${placeholders} ORDER BY ROWID DESC
        `;
        const thumbnailRows = await db.doAllSync(sql, patterns);
        let notFoundList = [];
        filePathes.forEach(filePath => {
            const findRow = findOne(thumbnailRows, filePath);
            if (findRow) {
                result[filePath] = serverUtil.joinThumbnailFolderPath(findRow.thumbnailFileName);
            }else{
                notFoundList.push(filePath);
            }
        })
        

        if(notFoundList.length > 0){
            const stringsToMatch = notFoundList; // string array of values
            const patterns = stringsToMatch.map(str => `${str}%`);
            const placeholders = patterns.map(() => 'filePath LIKE ?').join(' OR ');
            const sql = `
               SELECT *
               FROM file_table
               WHERE isImage=1 AND (${placeholders})
               ORDER BY mTime DESC`;
            let imagerows = await db.doAllSync(sql, patterns);
            notFoundList.forEach(filePath => {
                const findRow = findOne(imagerows, filePath);
                if (findRow) {
                    console.assert(findRow.isImage);
                    result[filePath] = findRow.filePath;
                }
            })
        }
    
        let end = getCurrentTime();
        // console.log(`[getThumbnailForFolders] ${(end - beg)}ms for ${filePathes.length} zips`);
    }catch(e){
        logger.error("[getThumbnailForFolders]", e);
    }
    return result;
}

/**
 * 单个filepath的thumbnail快速查找
 * @param {*} filePath 
 * @returns 
 */
async function getQuickThumbnailForZip(filePath){
    let url;
    const thumbnails = await getThumbnailsForZip([filePath])
    const oneThumbnail = thumbnails[filePath];
    if(oneThumbnail){
        url = oneThumbnail;
    }else{
        // 先找到发过去再说
        const fileName = path.basename(filePath);
        const thumbRows = await thumbnailDb.getThumbnailByFileName(fileName);
        if(thumbRows.length > 0){
            url = thumbRows[0].thumbnailFilePath;
        }
    }
    return url;
}

/**
* 查找thumbnail，同时判断是不是zip确实没有thumbnail
*/
async function getThumbnailsForZip(filePathes) {
    const isStringInput = _.isString(filePathes);
    if (isStringInput) {
        filePathes = [filePathes];
    }

    const thumbnails = {};

    let thumbRows = thumbnailDb.getThumbnailArr(filePathes);
    thumbRows.forEach(row => {
        thumbnails[row.filePath] = row.thumbnailFilePath;
    })

    filePathes.forEach(filePath => {
        if (thumbnails[filePath]) {
            return;
        }
        if (util.isCompress(filePath)) {
            const zipInfoRows = zipInfoDb.getZipInfo(filePath);
            if(zipInfoRows[0]){
                const pageNum = zipInfoRows[0].pageNum;
                if (pageNum === 0) {
                    thumbnails[filePath] = "NO_THUMBNAIL_AVAILABLE";
                }
            }
        }
    });

    return thumbnails;
}

module.exports = {
    getThumbnailForFolders,
    getQuickThumbnailForZip,
    getThumbnailsForZip
}