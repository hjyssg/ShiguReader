'use strict';

//https://stackoverflow.com/questions/11852589/what-image-formats-do-the-major-browsers-support-2012
const imageTypes = [".jpg", ".png", ".jpeg", ".gif", ".bmp", ".webp"];
const compressTypes = [".zip", ".rar", ".7zip", ".7z"];
const musicTypes = [".mp3", ".wav", ".m4a", ".wma", ".flac", ".ogg", ".m4p", ".m4a", ".aiff"];
const videoTypes = [".mp4", ".3gp", ".avi", ".mov", 
                    ".mp4", ".m4v", ".m4a", ".mkv",  ".webm" ];

//ends with
const imageTypesRegex = new RegExp("("+ imageTypes.join("|") + ")$");
const compressTypesRegex = new RegExp("("+ compressTypes.join("|") + ")$");
const musicTypesRegex = new RegExp("("+ musicTypes.join("|") + ")$");
const videoTypesRegex = new RegExp("("+ videoTypes.join("|") + ")$");


function isOnlyDigit(str){
    return str.match(/^[0-9]+$/) != null
}

module.exports.isGif= function (fn) {
    return fn.toLowerCase().endsWith(".gif");
};

const isImage = module.exports.isImage = function (fn) {
    return !!fn.toLowerCase().match(imageTypesRegex);
};

const isCompress = module.exports.isCompress = function (fn) {
    return !!fn.toLowerCase().match(compressTypesRegex);
};

const isMusic = module.exports.isMusic = function(fn){
    return !!fn.toLowerCase().match(musicTypesRegex);
}

const isVideo = module.exports.isVideo = function(fn){
    return !!fn.toLowerCase().match(videoTypesRegex);
}

const compressable = ["jpg", "jpeg", ".png",  ".gif"]
module.exports.canBeCompressed = function(fn){
    const fnl = fn.toLowerCase();
    return compressable.some((e) => fnl.endsWith(e));
}

//todo duplicate----------
 module.exports._sortFileNames = function (files, getBaseNameWithoutExtention) {
    if(!getBaseNameWithoutExtention){
        throw "no getBaseNameWithoutExtention";
    }

    const isAllDigit =  files.every(e => {
        return isOnlyDigit(getBaseNameWithoutExtention(e))
    });

    if(isAllDigit){
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

module.exports.escapeRegExp = function(string) {
    const str = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    var reg = new RegExp(str, 'i');
    return reg;
}

module.exports.useless_tag_regex = /DL版|同人誌|別スキャン|修正版|^エロ|^digital$|^JPG|^PNG|ページ補足/i;