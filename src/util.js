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

module.exports.getFn = function (fn) {
    if (!fn) { return ""; }
    const tokens = fn.split('\\');
    return tokens[tokens.length - 1];
};

module.exports.attach = function (obj) {
    obj.isImage = module.exports.isImage;
    obj.isCompress = module.exports.isCompress;
    obj.getDir = module.exports.getDir;
    obj.getFn = module.exports.getFn;
}
