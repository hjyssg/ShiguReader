const util = global.requireUtil();
const path = require('path');
const nameParser = require('../name-parser');
const sortUtil = require("../common/sortUtil");
const { isImage, isCompress, isCompressedThumbnail } = util;


const filterHiddenFile = module.exports.filterHiddenFile =function(files){
    return files.filter(f => {
        const temp =  path.basename(f);
        return temp && temp[0] !== ".";
    })
}

function isHiddenFile(f){
    const temp =  path.basename(f);
    return temp && temp[0] === ".";
}

module.exports.chooseOneZipForOneTag = function(files, fileToInfo){
    let _files = files.filter(e => {
        if(e.includes("アニメ") || !isCompress(e) || isHiddenFile(e)){
            return false;
        }
        return true;
    });
    _files = sortUtil.sort_file_by_time(_files, fileToInfo, getBaseName, false, false);
    return _files[0];
}

function getBaseName(e){
    return  path.basename(e);
}

module.exports.getDirName = function(p){
    const result =  path.dirname(p);
    return path.basename(result);
}

const sortFileNames = module.exports.sortFileNames = function(files){
    util._sortFileNames(files, e => path.basename(e, path.extname(e)));
}

module.exports.chooseThumbnailImage = function(files){
    let tempFiles = files.filter(isImage);
    tempFiles = filterHiddenFile(tempFiles);
    sortFileNames(tempFiles);
    const compressed = tempFiles.filter(isCompressedThumbnail);
    return compressed[0] || tempFiles[0];
}

module.exports.parse = function(str){
    return nameParser.parse(path.basename(str, path.extname(str)));
}

module.exports.common = {};