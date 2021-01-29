const loki = require("lokijs");

const util = global.requireUtil();
const { getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook, isImage, isMusic, isCompress, isVideo } = util;

let loki_db;
let zip_content_db;
const _ = require('underscore');

module.exports.init = function (path) {
    loki_db = new loki(path, {
        autoload: true,
        autoloadCallback: databaseInitialize,
        autosave: true,
        autosaveInterval: 4000
    });
}

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
    zip_content_db = loki_db.getCollection("zipInfo");
    if (zip_content_db === null) {
        zip_content_db = loki_db.addCollection("zipInfo", { indices: ['filePath'] });
    }
    var entryCount = zip_content_db.count();
    console.log("[zipInfoDb] number of entries in database : " + entryCount);
}

const has = module.exports.has = function (filePath) {
    const data = getData(filePath);
    return !!data;
}

function getData(filePath) {
    return zip_content_db && zip_content_db.findOne({ filePath: filePath });
}

//how many image files
const getPageNum = module.exports.getPageNum = function (filePath) {
    if (has(filePath)) {
        const contentInfo = getData(filePath);
        return +(contentInfo.pageNum) || 0;
    } else {
        return 0;
    }
}

//how many music files
const getMusicNum = module.exports.getMusicNum = function (filePath) {
    if (has(filePath)) {
        const contentInfo = getData(filePath);
        return +(contentInfo.musicNum) || 0;
    } else {
        return 0;
    }
}

module.exports.getZipInfo = function (filePathes) {
    const fpToInfo = {};

    const isStringInput = _.isString(filePathes);
    if(isStringInput){
        filePathes = [filePathes];
    }

    filePathes.forEach(filePath => {
        if (isCompress(filePath) && has(filePath)) {
            const contentInfo = getData(filePath);

            const files = contentInfo.files;
            const pageNum = files.filter(isImage).length;
            const musicNum = files.filter(isMusic).length;
            const videoNum = files.filter(isVideo).length;
            const totalImgSize = +(contentInfo.totalImgSize) || 0;

            const entry = {
                pageNum,
                musicNum,
                videoNum,
                totalNum: files.length,
                totalImgSize
            }

            fpToInfo[filePath] = entry;
        }
    });

    if(isStringInput){
        return fpToInfo[filePathes[0]]
    }

    return fpToInfo;
}

module.exports.deleteFromZipDb = function (filePath) {
    if (!zip_content_db) {
        return;
    }

    if (has(filePath)) {
        let data = getData(filePath);
        zip_content_db.remove(data);
    }
}

module.exports.updateZipDb = function (filePath, info) {
    if (!zip_content_db) {
        return;
    }

    const {  totalImgSize, files } = info;
    console.assert(files && files.length >= 0);

    const entry = {
            filePath,
            totalImgSize,
            files: files
    };

    //!!bug if shut the down the program, all data will be lost
    if (has(filePath)) {
        let data = getData(filePath);
        data = _.extend(data, entry)
        zip_content_db.update(data);
    } else {
        zip_content_db.insert(entry);
    }
}
