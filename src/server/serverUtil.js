const util = require("../util");
const path = require('path');
const nameParser = require('../name-parser');

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
    const _files = files.filter(e => {
        if(e.includes("アニメ") || !isCompress(e) || isHiddenFile(e)){
            return false;
        }
        return true;
    });
    nameParser.sort_file_by_time(_files, fileToInfo, getBaseName, false, false);
    return _files[0];
}

function getBaseName(e){
    return  path.basename(e);
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

