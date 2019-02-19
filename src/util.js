'use strict';

//https://stackoverflow.com/questions/11852589/what-image-formats-do-the-major-browsers-support-2012
const imageTypes = [".jpg", ".png", ".jpeg", ".gif", ".bmp", ".webp"];
const compressTypes = [".zip", ".rar", ".7zip"];
const musicTypes = [".mp3"];

function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}

module.exports.isImage = function (fn) {
    return imageTypes.some((e) => fn.toLowerCase().endsWith(e));
};

module.exports.isCompress = function (fn) {
    return compressTypes.some((e) => fn.toLowerCase().endsWith(e));
};

module.exports.isMusic = function(fn){
    return musicTypes.some((e) => fn.toLowerCase().endsWith(e));
}

//get parent
module.exports.getDir = function (fn) {
    if (!fn) { return ""; }
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

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

module.exports.sortFileNames = function (files) {
    const fileIndexs =  files.map(e => getFnWithoutExtention(e));

    if(fileIndexs.every(isOnlyDigit)){
      files.sort((a, b) =>  {return parseInt(getFnWithoutExtention(a)) - parseInt(getFnWithoutExtention(b)) });
    } else {
      files.sort((a, b) => a.localeCompare(b));
    }
};

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

module.exports.attach = function (obj) {
    obj.isImage = module.exports.isImage;
    obj.isCompress = module.exports.isCompress;
    obj.isMusic = module.exports.isMusic;

    obj.getDir = module.exports.getDir;
    obj.getFn = module.exports.getFn;
    obj.isPad = module.exports.isPad;
    obj.getPerPageItemNumber = module.exports.getPerPageItemNumber;
}

