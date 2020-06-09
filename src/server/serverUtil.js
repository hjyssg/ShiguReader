const util = global.requireUtil();
const path = require('path');
const nameParser = require('../name-parser');
const sortUtil = require("../common/sortUtil");
const { isImage, isCompress } = util;


const filterHiddenFile = module.exports.filterHiddenFile =function(files){
    return files.filter(f => {
        const temp =  path.basename(f);
        return temp && temp[0] !== ".";
    })
}

const isHiddenFile = module.exports.isHiddenFile = function(f){
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
    if(files.length === 0){
        return null;
    }

    let tempFiles = files.filter(e => isImage(e) && !isHiddenFile(e));
    sortFileNames(tempFiles);
    return tempFiles[0];
}

module.exports.parse = function(str){
    return nameParser.parse(path.basename(str, path.extname(str)));
}

module.exports.sep = "--=|=--";

module.exports.common = {};