const path = require('path');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
const fs = require('fs');
const _ = require('underscore');
// const ini = require('ini');

const logger = require("./logger");
const { isImage, isMusic, isVideo, isDisplayableInOnebook } = util;
const cache_folder_name = userConfig.cache_folder_name;
const pfs = require('promise-fs');
const junk = require('junk');


// 重要的path计算，关于所有文件的 读取
let rootPath = path.join(__dirname, "..", "..");
global.isPkg = !!process.pkg;
if(global.isPkg){
    rootPath = path.dirname(process.execPath);
}
// if (global.isWindows) {
//     rootPath = rootPath.charAt(0).toUpperCase() + rootPath.slice(1);
// }

/**
 * 【非常重要】获得项目的根目录的路径
 */
const getRootPath = module.exports.getRootPath = function () {
    return rootPath;
}

//for thumbnail url
// const fullPathToUrl = function (img) {
//     const fullpath = path.resolve(img);
//     return fullpath;
//     // return turnPathSepToWebSep(path.relative(rootPath, fullpath));
// }

// const turnPathSepToWebSep = function (fn) {
//     return fn.replace(new RegExp(`\\${path.sep}`, 'g'), '/');
// }

function isFilePath(str) {
    return path.parse(str).dir !== '';
  }

/**
 * for zip inside image and music files。把pathes按类拆分
 */
 module.exports.generateContentUrl = function (pathes, outputPath) {
    const files = [];
    const dirs = [];
    const musicFiles = [];
    const videoFiles = [];
    if (pathes) {
        for (let i = 0; i < pathes.length; i++) {
            const p = path.basename(pathes[i]);
            let fp = isFilePath(pathes[i])? pathes[i] : path.resolve(outputPath, pathes[i]);
            if (isImage(p)) {
                files.push(fp);
            } else if (isMusic(p)) {
                musicFiles.push(fp);
            } else if (isVideo(p)) {
                videoFiles.push(fp);
            }
        }
    }
    return { files, dirs, musicFiles, videoFiles };
}

const isExist = module.exports.isExist = async (tempPath) => {
    try {
        if (!tempPath) {
            return false;
        }
        const error = await pfs.access(tempPath);
        return !error;
    } catch (e) {
        return false;
    }
};

/**
 * 是否为直属parent directory
 */
 module.exports.isDirectParent =(parent, filePath) => {
    const parentPath = path.resolve(filePath, "..");
    return parentPath === parent;
}

const removeLastPathSep = module.exports.removeLastPathSep = (fp) => {
    //https://stackoverflow.com/questions/3884632/how-to-get-the-last-character-of-a-string
    if (fp.slice(-1) === path.sep) {
        return fp.slice(0, fp.length - 1);
    } else {
        return fp;
    }
}

/**
 * 是否为子目录，性能优化版
 */
const isSub = module.exports.isSub = (parent, child) => {
    if (global.isWindows) {
        parent = parent.toLowerCase();
        child = child.toLowerCase();
    }

    parent = removeLastPathSep(parent);
    child = removeLastPathSep(child);
    return parent && child && child.length > parent.length && child.startsWith(parent) && child[parent.length] === path.sep;
    // return parent && child && child.length > parent.length && child.startsWith(parent) && path.dirname(child) === parent;
}

if (global.isWindows) {
    console.assert(isSub("D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\", "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020"))
    console.assert(isSub("D:\\_Happy_Lesson\\_Going_to_sort\\_not_good", "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020"))
} else {
    console.assert(isSub("/Users/hjy/", "/Users/hjy/Downloads"))
}

/**
 * 删选实际存在的filepath 
 */
const filterNonExist = module.exports.filterNonExist = async (pathes, limit) => {
    const result = [];
    limit = limit || 100000;
    for (let ii = 0; ii < pathes.length; ii++) {
        const e = pathes[ii];
        if (await isExist(e)) {
            result.push(e);
        }
        if(limit && result.length > limit){
            break;
        }
    }

    return result;
}



/**
 * 算出项目相关的各种path
 */
module.exports.filterPathConfig = async (path_config, skipScan) => {
    let { good_folder_root, not_good_folder_root, scan_folder_pathes, quick_access_pathes, move_pathes } = path_config;

    move_pathes = await filterNonExist(move_pathes||[]);

    //add good folder
    const now = new Date();
    const y = now.getFullYear();
    let mm = now.getMonth() + 1;
    mm = (mm < 10) ? ("0" + (mm).toString()) : (mm).toString();

    let good_folder;
    if(good_folder_root){
        const fd = "good_" + [y, mm, "01"].join("_");
        good_folder =  path.resolve(good_folder_root, fd);
        move_pathes.unshift(good_folder);
    }


    // not good folder
    let not_good_folder;
    if(not_good_folder_root){
        const fd2 = "not_good_" + y;
        not_good_folder = path.resolve(not_good_folder_root, fd2);
        move_pathes.unshift(not_good_folder);
    }

    // scan path
    let scan_path = [].concat(scan_folder_pathes||[]);
    scan_path = scan_path.concat(good_folder, good_folder_root, not_good_folder_root, not_good_folder);
    scan_path.push(getImgConverterCachePath());
    scan_path.push(getZipOutputCachePath());
    scan_path = _.uniq(scan_path);

    if(skipScan){
        scan_path = [];
        scan_path.push(getImgConverterCachePath());
        scan_path.push(getZipOutputCachePath());

        quick_access_pathes = [good_folder, good_folder_root, not_good_folder_root, not_good_folder,  ...quick_access_pathes];
        quick_access_pathes = _.uniq(quick_access_pathes);
    }
    quick_access_pathes = await filterNonExist(quick_access_pathes||[]);
    scan_path = await filterNonExist(scan_path||[]);

    return {
       scan_path,
       good_folder_root : good_folder_root || "",
       not_good_folder_root : not_good_folder_root || "",
       quick_access_pathes: quick_access_pathes,
       good_folder,    
       not_good_folder,
       move_pathes   
    };
}

const getWorkSpacePath = module.exports.getWorkSpacePath = () => {
    return  path.join(getRootPath(), userConfig.workspace_name);
}

const getImgConverterCachePath = module.exports.getImgConverterCachePath = () => {
    const imgConvertFolder = path.join(getWorkSpacePath(), userConfig.img_convert_cache);
    return imgConvertFolder;
}

const getZipOutputCachePath = module.exports.getZipOutputCachePath = () => {
    return path.join(getWorkSpacePath(), userConfig.zip_output_cache);
}

const getExt = module.exports.getExt = function (p) {
    const ext = path.extname(p).toLowerCase();
    if (ext === ".!ut") {
        return ext;
    }

    const isAlphebetorNumber = /^\.[a-zA-z0-9]*$/.test(ext);  // e.g .7z
    const isOnlyDigit = /^\.[0-9]*$/.test(ext); // e.g   445
    const isFileSize =  /\d+\.\d+\s*(?:MB|GB)]$/i.test(p);  // e.g 456.28 MB] or 120.44 GB]

    //xxx NO.003 xxx is not meaningful extension
    //extension string should be alphabet(may with digit), but not only digit
    if (ext && isAlphebetorNumber  && !isOnlyDigit && !isFileSize) {
        return ext;
    } else {
        return "";
    }
}

/**
 * not accurate, but performance is good. access each file is very slow 
 * 根据有无后缀快速判断估算是不是文件夹。没有才可能是文件
 */
const estimateIfFolder = module.exports.estimateIfFolder = function(filePath){
   const ext = getExt(filePath);
   return !ext 
}

/**
 * 递归文件夹，结果存在resultArr
 */
const readdirRecursive = module.exports.readdirRecursive = async (filePath, resultArr) => {
    let pathes = await pfs.readdir(filePath);
    pathes = pathes.map(e => path.resolve(filePath, e));

    for(let ii = 0; ii < pathes.length; ii++){
        try{
                const fp = pathes[ii];
                if(isHiddenFile(fp) || isForbid(fp)){
                    continue;
                }
                if(isDisplayableInOnebook(fp)){
                    resultArr.push(fp)
                }else if(estimateIfFolder(fp)){
                    const stat = await pfs.stat(filePath);
                    if(stat.isDirectory()){
                        await readdirRecursive(fp, resultArr);
                    }
                }
        }catch(e){
            logger.error("readdirRecursive", e);
        }
    }
}

/*
* 单层读取文件
*/
module.exports.readdirOneLevel = async function (fp, option) {
    try {
        let pathes = await pfs.readdir(fp, option);
        pathes = pathes.filter(e => {
            if (option && option.withFileTypes) {
                e = e.name;
            }
            return !isHiddenFile(e) && !isForbid(e);
        });
        return pathes;
    } catch (e) {
        logger.error(e);
        return [];
    }
}

/**
 * 判断是否为隐藏文件
 */
const filterHiddenFile = module.exports.filterHiddenFile = function (files) {
    return files.filter(f => {
        const temp = path.basename(f);
        return temp && temp.length > 1 && temp[0] !== ".";
    })
}


module.exports.getDirName = function (p) {
    const result = path.dirname(p);
    return path.basename(result);
}

const isHiddenFile = module.exports.isHiddenFile = function (f) {
    const temp = path.basename(f);
    return temp && temp[0] === ".";
}

const forbid = ["System Volume Information",
    "$Recycle.Bin",
    "Config.Msi",
    "$WinREAgent",
    "Windows",
    "msdownld.tmp",
    "node_modules"];
const isForbid = module.exports.isForbid = function (str) {
    str = str.toLocaleLowerCase();
    return junk.is(str) || forbid.some(e => {
        return path.basename(str) === e.toLocaleLowerCase();
    });
}