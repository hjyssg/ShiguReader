'use strict';

const imageTypes = [".jpg", ".png"];
const compressTypes = [".zip", ".rar", ".7zip"];

module.exports.isImage = function (fn) {
    return imageTypes.some((e) => fn.toLowerCase().endsWith(e));
};

module.exports.isCompress = function (fn) {
    return compressTypes.some((e) => fn.toLowerCase().endsWith(e));
};

//get parent
module.exports.getDir = function (fn) {
    if (!fn) { return ""; }
    const tokens = fn.split('\\');
    return tokens.slice(0, tokens.length - 1).join('\\');
};

module.exports.getFn = function (fn, seperator) {
    if (!fn) { return ""; }
    const tokens = seperator? fn.split(seperator) : fn.split('\\');
    return tokens[tokens.length - 1];
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
    obj.getDir = module.exports.getDir;
    obj.getFn = module.exports.getFn;
    obj.isPad = module.exports.isPad;
    obj.getPerPageItemNumber = module.exports.getPerPageItemNumber;
}

