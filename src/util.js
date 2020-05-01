'use strict';

//https://stackoverflow.com/questions/11852589/what-image-formats-do-the-major-browsers-support-2012
const imageTypes = [".jpg", ".png", ".jpeg", ".gif", ".bmp", ".webp"];
const compressTypes = [".zip", ".rar", ".7zip", ".7z"];
const musicTypes = [".mp3", ".wav"];
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

module.exports.isMusic = function(fn){
    return musicTypes.some((e) => fn.toLowerCase().endsWith(e));
}

module.exports.isVideo = function(fn){
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
 module.exports._sortFileNames = function (files, getFnWithoutExtention) {
    if(!getFnWithoutExtention){
        throw "no getFnWithoutExtention";
    }

    const fileIndexs =  files.map(e => getFnWithoutExtention(e));

    if(fileIndexs.every(isOnlyDigit)){
      files.sort((a, b) =>  {return parseInt(getFnWithoutExtention(a)) - parseInt(getFnWithoutExtention(b)) });
    } else {
      files.sort((a, b) => a.localeCompare(b));
    }
};


module.exports.array_unique = function(arr){
    const result = [];
    const marked = {};
    (arr || []).forEach(e => {
        if(!marked[e]){
            result.push(e);
            marked[e] = true;
        }
    });
    return result;
}