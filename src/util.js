'use strict';

//https://stackoverflow.com/questions/11852589/what-image-formats-do-the-major-browsers-support-2012
const imageTypes = [".jpg", ".png", ".jpeg", ".gif", ".bmp", ".webp"];
const compressTypes = [".zip", ".rar", ".7zip", ".7z"];
const musicTypes = [".mp3", ".wav", ".m4a", ".wma", ".flac", ".ogg", ".m4p", ".m4a", ".aiff"];
const videoTypes = [".mp4", ".3gp", ".avi", ".mov", 
                    ".mp4", ".m4v", ".m4a", ".mkv",  ".webm" ];

function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}

const isImage = module.exports.isImage = function (fn) {
    return imageTypes.some((e) => fn.toLowerCase().endsWith(e));
};

const isCompress = module.exports.isCompress = function (fn) {
    return compressTypes.some((e) => fn.toLowerCase().endsWith(e));
};

const isMusic = module.exports.isMusic = function(fn){
    return musicTypes.some((e) => fn.toLowerCase().endsWith(e));
}

const isVideo = module.exports.isVideo = function(fn){
    return videoTypes.some((e) => fn.toLowerCase().endsWith(e));
}

const THUMBNAIL_FLAG = "thumbnail--";
const isCompressedThumbnail = module.exports.isCompressedThumbnail = function(filename){
    return filename && filename.includes(THUMBNAIL_FLAG);
}

module.exports.getCompressedThumbnailFileName = function(filename){
    return THUMBNAIL_FLAG + filename;
}

const compressable = ["jpg", "jpeg", ".png",  ".gif"]
module.exports.canBeCompressed = function(fn){
    return compressable.some((e) => fn.toLowerCase().endsWith(e));
}

//todo duplicate----------
 module.exports._sortFileNames = function (files, getBaseNameWithoutExtention) {
    if(!getBaseNameWithoutExtention){
        throw "no getBaseNameWithoutExtention";
    }

    const fileIndexs =  files.map(e => getBaseNameWithoutExtention(e));

    if(fileIndexs.every(isOnlyDigit)){
      files.sort((a, b) =>  {return parseInt(getBaseNameWithoutExtention(a)) - parseInt(getBaseNameWithoutExtention(b)) });
    } else {
      files.sort((a, b) => a.localeCompare(b));
    }
};

module.exports.arraySlice = function(arr, beg, end){
    const len = arr.length;
    let _beg = beg >= 0? beg : len + beg;
    let _end = end >= 0? end : len + end;

    let result = [];
    if(beg >= 0 && end >= 0){
        //normal
        result = arr.slice(beg, end);
    }else if(beg < 0 && end > 0){
        result = arr.slice(_beg).concat(arr.slice(0, end));
    }else if(beg >= 0 && end < 0){
        result = arr.slice(beg, _end);
    }else{
        throw "wrf dude"
    }
    return result;
}

module.exports.getCurrentTime = function(){
    return new Date().getTime();
}

module.exports.isDisplayableInExplorer = function(e){
    return isCompress(e) || isVideo(e);
}

module.exports.isDisplayableInOnebook = function(e){
    return isImage(e)||isMusic(e);
}