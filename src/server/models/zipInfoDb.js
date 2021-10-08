const Loki = require("lokijs");
const util = global.requireUtil();
const { isImage, isMusic, isCompress, isVideo } = util;
const _ = require('underscore');

const userConfig = global.requireUserConfig();
const path = require('path');
const pathUtil = require("../pathUtil");

let loki_db;
let zip_content_db;
const rootPath = pathUtil.getRootPath();
let zip_content_db_path = path.join(rootPath, userConfig.workspace_name, "zip_info");


// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
    zip_content_db = loki_db.getCollection("zipInfo");
    if (zip_content_db === null) {
        zip_content_db = loki_db.addCollection("zipInfo", { indices: ['filePath'] });
    }
    const entryCount = zip_content_db.count();
    console.log("[zipInfoDb] number of entries in database : " + entryCount);
}

loki_db = new Loki(zip_content_db_path, {
    autoload: true,
    autoloadCallback: databaseInitialize,
    autosave: true,
    autosaveInterval: 4000
});

function getData(filePath) {
    return zip_content_db && zip_content_db.findOne({ filePath });
}

const has = module.exports.has = function (filePath) {
    const data = getData(filePath);
    return !!data;
}

module.exports.updateThumbnail = function(oldfilePath, newfilePath){
    const data = getData(oldfilePath)
    if (data){
        data.filePath = newfilePath;
        zip_content_db.insert(entry);
    }
}

module.exports.getZipInfo = function (filePathes) {
    const fpToInfo = {};

    const isStringInput = _.isString(filePathes);
    if (isStringInput) {
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

    if (isStringInput) {
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

    const { totalImgSize, files } = info;
    console.assert(files && files.length >= 0);

    const entry = {
        filePath,
        totalImgSize,
        files
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
