const path = require('path');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
const fs = require('fs');
const isWindows = require('is-windows');
const _ = require('underscore');
const ini = require('ini');


const { isImage, isMusic, isVideo, isDisplayableInOnebook } = util;
const cache_folder_name = userConfig.cache_folder_name;
const pfs = require('promise-fs');

let rootPath = path.resolve(process.cwd()); // path.join(__dirname, "..", "..");
if (isWindows()) {
    rootPath = rootPath.charAt(0).toUpperCase() + rootPath.slice(1)
}
const getRootPath = function () {
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

//for zip inside image and music files
const generateContentUrl = function (pathes, outputPath) {
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

const isExist = async (tempPath) => {
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

function isDirectParent(parent, filePath) {
    const parentPath = path.resolve(filePath, "..");
    return parentPath === parent;
}

function removeLastPathSep(fp) {
    //https://stackoverflow.com/questions/3884632/how-to-get-the-last-character-of-a-string
    if (fp.slice(-1) === path.sep) {
        return fp.slice(0, fp.length - 1);
    } else {
        return fp;
    }
}

// 是否为字目录，性能优化版
function isSub(parent, child) {
    if (isWindows()) {
        parent = parent.toLowerCase();
        child = child.toLowerCase();
    }

    parent = removeLastPathSep(parent);
    child = removeLastPathSep(child);
    return parent && child && child.length > parent.length && child.startsWith(parent) && child[parent.length] === path.sep;
    // return parent && child && child.length > parent.length && child.startsWith(parent) && path.dirname(child) === parent;
}

if (isWindows()) {
    console.assert(isSub("D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\", "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020"))
    console.assert(isSub("D:\\_Happy_Lesson\\_Going_to_sort\\_not_good", "D:\\_Happy_Lesson\\_Going_to_sort\\_not_good\\not_good_2020"))
} else {
    console.assert(isSub("/Users/hjy/", "/Users/hjy/Downloads"))
}

async function filterNonExist(pathes) {
    for (let ii = 0; ii < pathes.length; ii++) {
        const e = pathes[ii];
        if (!e) {
            pathes[ii] = null;
        }

        if (!(await isExist(e))) {
            pathes[ii] = null;
        }
    }

    return pathes.filter(e => !!e);
}

// function parse_aji_path_config(fileContent, sepArr){
//     let pathes = fileContent.toString().split('\n');
//     pathes = pathes
//         .map(e => e.trim().replace(/\n|\r/g, ""))
//         .filter(pp => { return pp && pp.length > 0 && !pp.startsWith("#") && !pp.startsWith(";"); });
//     pathes = _.uniq(pathes);

//     const indexArr = sepArr.map(sep =>  {
//        return pathes.findIndex(e => e.includes(sep));
//     })

//     const result = [];
//     for(let ii = 0; ii < indexArr.length; ii++){
//         const curIndex = indexArr[ii];
//         const nextIndex = indexArr[ii+1];
//         let part;
//         if(nextIndex){
//             part = pathes.slice(curIndex+1, nextIndex)
//         }else {
//             part = pathes.slice(curIndex+1);
//         }
//         result.push(part);
//     }

//     return result;
// }

async function getScanPath() {
    const path_config_path = path.join(getRootPath(), "config-path.ini");
    const fContent1 = fs.readFileSync(path_config_path).toString();

    const path_config = ini.parse(fContent1);
    let { good_folder_root, not_good_folder_root, folder_pathes } = path_config;
    let scan_path = [].concat(folder_pathes);
    // const move_path_config_path = path.join(getRootPath(), "config-move-path.ini");
    // const fContent2 = fs.readFileSync(move_path_config_path).toString();
    // const moveObj = ini.parse(fContent2);

    global.good_folder_root = good_folder_root || "";
    global.not_good_folder_root = not_good_folder_root || "";
    //less freedom for more noob-friendly

    //add good folder
    const now = new Date();
    const y = now.getFullYear();
    let mm = now.getMonth() + 1;
    mm = (mm < 10) ? ("0" + (mm).toString()) : (mm).toString();
    const fd = "good_" + [y, mm, "01"].join("_");
    const good_folder = good_folder_root && path.resolve(good_folder_root, fd);
    global.good_folder = good_folder;

    //add not good folder
    const fd2 = "not_good_" + y;
    const not_good_folder = not_good_folder_root && path.resolve(not_good_folder_root, fd2);
    global.not_good_folder = not_good_folder;

    scan_path = scan_path.concat(good_folder, good_folder_root,
        not_good_folder_root, not_good_folder);

    scan_path.push(getImgConverterCachePath());
    scan_path.push(getZipOutputCachePath());

    scan_path = _.uniq(scan_path);

    return {
        scan_path
    };
}

function getImgConverterCachePath() {
    const imgConvertFolder = path.join(getRootPath(), userConfig.workspace_name, userConfig.img_convert_cache);
    return imgConvertFolder;
}

function getZipOutputCachePath() {
    return path.join(getRootPath(), userConfig.workspace_name, userConfig.zip_output_cache);
}

//递归文件夹，结果存在resultArr
const readdirRecursive = async (filePath, resultArr) => {
    let pathes = await pfs.readdir(filePath);
    pathes = pathes.map(e => path.resolve(filePath, e));

    for(let ii = 0; ii < pathes.length; ii++){
        try{
                const fp = pathes[ii];
                // const ext = path.extname(fp).toLowerCase();
                // const isFolder = !ext;
                if(isDisplayableInOnebook(fp)){
                    resultArr.push(fp)
                }else{
                    const stat = await pfs.stat(filePath);
                    if(stat.isDirectory()){
                        await readdirRecursive(fp, resultArr);
                    }
                }
        }catch(e){
            console.error(e);
        }
    }
}

module.exports = {
    generateContentUrl,
    getRootPath,
    filterNonExist,
    isExist,
    isDirectParent,
    isSub,
    getScanPath,
    getImgConverterCachePath,
    getZipOutputCachePath,
    removeLastPathSep,
    readdirRecursive
};