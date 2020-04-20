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

module.exports.isCompress = function (fn) {
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

module.exports.chooseThumbnailImage = function(files){
    let tempFiles = files.filter(isImage);
    tempFiles = filterHiddenFile(tempFiles);
    sortFileNames(tempFiles);
    const compressed = tempFiles.filter(isCompressedThumbnail);
    return compressed[0] || tempFiles[0];
}

//get parent
module.exports.getDir = function (fn) {
    if (!fn) { return ""; }
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

// '\' is for browser path
const getFn = module.exports.getFn = function (fn, seperator) {
    if (!fn) { return ""; }
    const tokens = seperator? fn.split(seperator) : fn.split('\\');
    return tokens[tokens.length - 1];
};

const getFnWithoutExtention = module.exports.getFnWithoutExtention = function (fn, seperator) {
    seperator = seperator || "/"
    if (!fn) { return ""; }
    return getFn(fn, seperator).split(".")[0];
};

//used by client
module.exports.getUrl = function (fn){
    return "../" + fn;
}

const sortFileNames = module.exports.sortFileNames = function (files) {
    const fileIndexs =  files.map(e => getFnWithoutExtention(e));

    if(fileIndexs.every(isOnlyDigit)){
      files.sort((a, b) =>  {return parseInt(getFnWithoutExtention(a)) - parseInt(getFnWithoutExtention(b)) });
    } else {
      files.sort((a, b) => a.localeCompare(b));
    }
};

const filterHiddenFile = module.exports.filterHiddenFile =function(files){
    return files.filter(f => {
        const temp = getFn(f, "/");
        return temp && temp[0] !== ".";
    })
}

const isPad = module.exports.isPad = function(){
    // https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

module.exports.getPerPageItemNumber = function() {
    if(isPad()){
        return 3 * 6;
    }else{
        return 4 * 5;
    }
}

module.exports.stringHash = function (str) {
    const stringHash = require("string-hash");
    const  result = stringHash(str);
    window.localStorage && window.localStorage.setItem(result, str)
    return result;
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

module.exports.attach = function (obj) {
    obj.isImage = module.exports.isImage;
    obj.isCompress = module.exports.isCompress;
    obj.isMusic = module.exports.isMusic;

    obj.getDir = module.exports.getDir;
    obj.getFn = module.exports.getFn;
    obj.isPad = module.exports.isPad;
    obj.getPerPageItemNumber = module.exports.getPerPageItemNumber;
    obj.stringHash = module.exports.stringHash;
}

