'use strict';

//https://stackoverflow.com/questions/11852589/what-image-formats-do-the-major-browsers-support-2012
const imageTypes = [".jpg", ".png", ".jpeg", ".gif", ".bmp", ".webp", ".avif"];
const compressTypes = [".zip", ".rar", ".7zip", ".7z", ".gzip", ".tar"];
const musicTypes = [".mp3", ".wav", ".m4a", ".wma", ".flac", ".ogg", ".m4p", ".aiff"];
const videoTypes = [".mp4", ".3gp", ".avi", ".mov",".mp4", ".m4v", ".mkv", ".webm", ".flv"];

function escapeDot(arr) {
    return arr.map(e => e.replace(".", "\\."))
}

//ends with
const imageTypesRegex = new RegExp("(" + escapeDot(imageTypes).join("|") + ")$");
const compressTypesRegex = new RegExp("(" + escapeDot(compressTypes).join("|") + ")$");
const musicTypesRegex = new RegExp("(" + escapeDot(musicTypes).join("|") + ")$");
const videoTypesRegex = new RegExp("(" + escapeDot(videoTypes).join("|") + ")$");


function isOnlyDigit(str) {
    return str.match(/^[0-9]+$/) != null
}

module.exports.isGif = function (fn) {
    return fn.toLowerCase().endsWith(".gif");
};

/**
 * 是否为图片文件
 */
const isImage = module.exports.isImage = function (fn) {
    return !!fn.toLowerCase().match(imageTypesRegex);
};

/**
 * 是否为压缩文件
 */
const isCompress = module.exports.isCompress = function (fn) {
    return !!fn.toLowerCase().match(compressTypesRegex);
};

/**
 * 是否为音乐文件
 */
const isMusic = module.exports.isMusic = function (fn) {
    return !!fn.toLowerCase().match(musicTypesRegex);
}

const isVideo = module.exports.isVideo = function (fn) {
    return !!fn.toLowerCase().match(videoTypesRegex);
}

const companyNames = "ABP ATFB AVOP CPDE CSCT DASD EBOD FDGD GANA GGG HND HNDS ID IPX IPZ KAWD LCBD LXVS MDS MIDE MIMK MIRD MUKC NHDTA PGD PPPD PPT REBDB SDDE SHKD SNIS SOE SSNI STAR TEK TONY TPRO TSDV WANZ WAT YRZ ZUKO DAP";
const avRegex = new RegExp(companyNames.split(" ").filter(e => e.length > 1).map(e => `${e}\\d{3}`).join("|"));

module.exports.isAv = function (fn) {
    if (!isVideo(fn)) {
        return false;
    }

    //example ABP-265
    if (/[A-Za-z]{2,}-\d{3}/.test(fn)) {
        return true;
    }

    //ABP264
    const fnUp = fn.toUpperCase();
    return avRegex.test(fnUp);
}

//not for .gif
const compressable = [".jpg", ".jpeg", ".png", ".avif", "webp", ".bmp"]
module.exports.canBeCompressed = function (fn) {
    const fnl = fn.toLowerCase();
    return compressable.some((e) => fnl.endsWith(e));
}

const hasDuplicate = module.exports.hasDuplicate = (arr) => {
    return new Set(arr).size !== arr.length;
}




/**
 * 用来排序图片和mp3的。files既可能是filename也可能是filepath
 * getDirName is optional and should return the directory portion used for sorting
 */
module.exports._sortFileNames = function (files, getBaseName, getDirName) {
    // files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    // return;

    files.sort((a, b) => {
        // 使用 getBaseName 获取文件名部分
        const fileNameA = getBaseName(a);
        const fileNameB = getBaseName(b);

        // 获取路径部分（去掉文件名部分后的内容）
        const dirA = (() => {
            if (getDirName) {
                return getDirName(a) || "";
            }
            if (typeof fileNameA === "string" && a.endsWith(fileNameA)) {
                return a.slice(0, a.length - fileNameA.length) || "";
            }
            return "";
        })();

        const dirB = (() => {
            if (getDirName) {
                return getDirName(b) || "";
            }
            if (typeof fileNameB === "string" && b.endsWith(fileNameB)) {
                return b.slice(0, b.length - fileNameB.length) || "";
            }
            return "";
        })();

        // 先按路径部分排序
        if (dirA !== dirB) {
            return dirA.localeCompare(dirB);
        }else{
            // 如果路径部分相同，按文件名数值排序
            return fileNameA.localeCompare(fileNameB, undefined, { numeric: true });
        }
    });
};

module.exports.pause = async (time) => {
    await new Promise(resolve => setTimeout(resolve, time));
}

module.exports.arraySlice = function (arr, beg, end) {
    const len = arr.length;
    let _beg = beg >= 0 ? beg : len + beg;
    let _end = end >= 0 ? end : len + end;

    let result = [];
    if (beg >= 0 && end >= 0) {
        //normal
        result = arr.slice(beg, end);
    } else if (beg < 0 && end > 0) {
        result = arr.slice(_beg).concat(arr.slice(0, end));
    } else if (beg >= 0 && end < 0) {
        result = arr.slice(beg, _end);
    } else {
        throw "wrf dude"
    }
    return result;
}

module.exports.cutIntoSmallArrays = (arr, size)=> {
    size = size || 10000;
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        const chunk = arr.slice(i, i + size);
        result.push(chunk);
    }
    return result;
}

module.exports.getCurrentTime = function () {
    return new Date().getTime();
}

module.exports.isDisplayableInExplorer = function (e) {
    return isCompress(e) || isVideo(e);
}

module.exports.isDisplayableInOnebook = function (e) {
    return isImage(e) || isMusic(e);
}

module.exports.escapeRegExp = function (string) {
    const str = string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    const reg = new RegExp(str, 'i');
    return reg;
}

module.exports.isWindowsPath = function (string) {
    return /[A-Za-z]:/.test(string);
}

/**
 * 求平均数
 */
module.exports.getAverage = function(intArray) {
    if (intArray.length === 0) {
      return 0;
    }

    const sum = intArray.reduce((acc, val) => acc + val);
    const avg = sum / intArray.length;

    return avg;
}

/**
 * Calculate average image size for a zip/folder.
 *
 * @param {Object} param0
 * @param {number} param0.pageNum    total number of files reported
 * @param {number} [param0.totalImgSize] summed size of image files
 * @param {number} [param0.videoNum] number of video files included
 * @returns {number} average size of image files
 */
module.exports.calcAvgImgSize = function({ pageNum, totalImgSize = 0, videoNum = 0 }) {
    const imgCount = Math.max(0, pageNum - videoNum);
    if (imgCount === 0) {
        return 0;
    }

    return totalImgSize / imgCount;
}


/** 写一个js函数，把string留头留尾，中间的字符换成省略号。穿参数设置最终字符数 */
const truncateString = module.exports.truncateString = (str, maxLength) => {
    if (str.length <= maxLength) return str;
    const ellipsis = '...';
    const truncatedLength = maxLength - ellipsis.length;
    const frontChars = Math.ceil(truncatedLength / 2);
    const backChars = Math.floor(truncatedLength / 2);
    const truncatedString = str.substr(0, frontChars) + ellipsis + str.substr(str.length - backChars);
    return truncatedString;
}

