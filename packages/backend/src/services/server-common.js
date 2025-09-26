const _ = require('underscore');
const path = require('path');
const pfs = require('promise-fs');

const serverUtil = require('../utils/server-util');
const thumbnailUtil = require('./thumbnail-query');
const db = require('../models/db');
const historyDb = require('../models/history-db');
const zipInfoDb = require('../models/zip-info-db');
const thumbnailDb = require('../models/thumbnail-db');
const filewatch = require('./file-watchers/file-watch');

async function getStatAndUpdateDB(filePath) {
    const stat = await pfs.stat(filePath);
    if (filewatch.isAlreadyScan(filePath)) {
        db.updateStatToDb(filePath, stat);
    }
    return stat;
}

async function decorateResWithMeta(resObj) {
    const { fileInfos, dirs, imgFolders } = resObj;
    console.assert(fileInfos && dirs && imgFolders);

    const files = _.keys(fileInfos);

    const thumbnails = await thumbnailUtil.getThumbnailsForZip(files);
    _.keys(thumbnails).forEach(filePath => {
        if (!fileInfos[filePath]) {
            return;
        }
        const entry = thumbnails[filePath];
        fileInfos[filePath].thumbnailFilePath = entry;
    });

    const zipInfoRows = zipInfoDb.getZipInfo(files);
    zipInfoRows.forEach(row => {
        if (!fileInfos[row.filePath]) {
            return;
        }
        fileInfos[row.filePath] = {
            ...fileInfos[row.filePath],
            pageNum: row.pageNum,
            musicNum: row.musicNum,
            videoNum: row.videoNum,
            totalNum: row.totalNum,
            totalImgSize: row.totalImgSize,
        };
        fileInfos[row.filePath].mtimeMs = fileInfos[row.filePath].mtimeMs || row.mtime;
        fileInfos[row.filePath].size = fileInfos[row.filePath].size || row.totalSize;
    });

    const imgFolderInfo = db.getImgFolderInfo(imgFolders);
    resObj.imgFolderInfo = imgFolderInfo;

    const pathsForHistory = [...files, ..._.keys(imgFolderInfo)];
    resObj.fileHistory = await historyDb.getBatchFileHistory(pathsForHistory);

    resObj.nameParseCache = {};
    [...files, ..._.keys(imgFolderInfo), ...dirs].forEach(fp => {
        const fn = path.basename(fp);
        const parsed = serverUtil.parse(fn);
        if (parsed) {
            resObj.nameParseCache[fn] = parsed;
        }
    });

    const allowedKeys = [
        'dirs',
        'mode',
        'tag',
        'path',
        'author',
        'fileInfos',
        'imgFolderInfo',
        'fileHistory',
        'nameParseCache',
    ];
    resObj = serverUtil.filterObjectProperties(resObj, allowedKeys);

    return resObj;
}

function deleteCallBack(fp) {
    db.deleteFromDb(fp);
    zipInfoDb.deleteFromZipDb(fp);
    thumbnailDb.deleteThumbnail(fp);
}

module.exports = {
    getStatAndUpdateDB,
    decorateResWithMeta,
    deleteCallBack,
};
