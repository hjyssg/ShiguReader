const util = require("../util");
const path = require('path');

const { isImage, isCompress, isCompressedThumbnail } = util;



const filterHiddenFile = module.exports.filterHiddenFile =function(files){
    return files.filter(f => {
        const temp =  path.basename(f);
        return temp && temp[0] !== ".";
    })
}

module.exports.chooseOneZipForOneTag = function(files){
    const _files = files.filter(e => {
        if(e.includes("アニメ")){
            return false;
        }
        return true;
    });
    let tempFiles =  _files.filter(isCompress);
    tempFiles = filterHiddenFile(tempFiles);
    return tempFiles[0];
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

