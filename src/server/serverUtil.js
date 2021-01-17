const util = global.requireUtil();
const path = require('path');
const nameParser = require('../name-parser');
const sortUtil = require("../common/sortUtil");
const { isImage, isCompress } = util;


const filterHiddenFile = module.exports.filterHiddenFile = function (files) {
    return files.filter(f => {
        const temp = path.basename(f);
        return temp && temp[0] !== ".";
    })
}

const isHiddenFile = module.exports.isHiddenFile = function (f) {
    const temp = path.basename(f);
    return temp && temp[0] === ".";
}

module.exports.chooseOneZipForOneTag = function (files, fileInfos) {
    let _files = files.filter(e => {
        if (e.includes("アニメ") || !isCompress(e) || isHiddenFile(e)) {
            return false;
        }
        return true;
    });

    const config = {
        fileInfos, 
        getBaeName, 
        fromEarly: false, 
        onlyMtime: false
    }

    _files = sortUtil.sort_file_by_time(_files, config);
    return _files[0];
}

function getBaseName(e) {
    return path.basename(e);
}

module.exports.getDirName = function (p) {
    const result = path.dirname(p);
    return path.basename(result);
}

const sortFileNames = module.exports.sortFileNames = function (files) {
    util._sortFileNames(files, e => path.basename(e, path.extname(e)));
}

module.exports.chooseThumbnailImage = function (files) {
    if (files.length === 0) {
        return null;
    }

    let tempFiles = files.filter(e => isImage(e) && !isHiddenFile(e));
    sortFileNames(tempFiles);
    return tempFiles[0];
}

module.exports.parse = function (str) {
    return nameParser.parse(path.basename(str, path.extname(str)));
}


module.exports.getExt = function(p) {
    const ext = path.extname(p).toLowerCase();
    //xxx NO.003 xxx is not meaningful extension
    //extension string should be alphabet(may with digit), but not only digit
    if (ext && /^\.[a-zA-z0-9]*$/.test(ext) && !/^\.[0-9]*$/.test(ext)) {
        return ext;
    } else {
        return "";
    }
}

module.exports.common = {};