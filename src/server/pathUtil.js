const path = require('path');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
const fs = require('fs');
const isWindows = require('is-windows');
const _ = require('underscore');
const ini = require('ini');


const { isImage, isMusic, isVideo } = util;
const cache_folder_name = userConfig.cache_folder_name;
const pfs = require('promise-fs');

const rootPath = process.cwd() // path.join(__dirname, "..", "..");
const getRootPath = function () {
    return rootPath;
}

//for thumbnail url
const fullPathToUrl = function (img) {
    const fullpath = path.resolve(img);
    return turnPathSepToWebSep(path.relative(rootPath, fullpath));
}

const turnPathSepToWebSep = function (fn) {
    return fn.replace(new RegExp(`\\${path.sep}`, 'g'), '/');
}

//for zip inside image and music files
const generateContentUrl = function (pathes, outputPath) {
    const files = [];
    const dirs = [];
    const musicFiles = [];
    const videoFiles = [];
    if (pathes) {
        const base = path.basename(outputPath);
        for (let i = 0; i < pathes.length; i++) {
            const p = path.basename(pathes[i]);
            let temp = path.join(cache_folder_name, base, p);
            temp = turnPathSepToWebSep(temp);
            if (isImage(p)) {
                files.push(temp);
            } else if (isMusic(p)) {
                musicFiles.push(temp);
            } else if(isVideo(p)){
                videoFiles.push(temp);
            }
        }
    }
    return { files, dirs, musicFiles, videoFiles };
}

const isExist = async (path) => {
    try {
        const error = await pfs.access(path);
        return !error;
    } catch (e) {
        return false;
    }
};

function isDirectParent(parent, filePath) {
    const parentPath = path.resolve(filePath, "..");
    return parentPath === parent;
}

function isSub(parent, child) {
    return parent && child && child.length > parent.length && child.startsWith(parent) && child[parent.length] === path.sep;
}

async function filterNonExist(pathes) {
    for (let ii = 0; ii < pathes.length; ii++) {
        const e = pathes[ii];
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

async function getHomePath() {
    const path_config_path = path.join(getRootPath(), "path-config.ini");
    const fContent1 = fs.readFileSync(path_config_path).toString();

    const path_config = ini.parse(fContent1);
    let path_will_scan =  [].concat(path_config.path);

    const move_path_config_path = path.join(getRootPath(), "move-path-config.ini");
    const fContent2 = fs.readFileSync(move_path_config_path).toString();
    const moveObj = ini.parse(fContent2);

    const { good_folder_root, not_good_folder_root, additional_folder} = moveObj;

    global.good_folder_root = good_folder_root;
    global.not_good_folder_root= not_good_folder_root;
    global.additional_folder = additional_folder;
    //less freedom for more noob-friendly

    //add good folder
    const now = new Date();
    const y = now.getFullYear();
    let mm = now.getMonth() + 1;
    mm = (mm < 10) ? ("0" + (mm).toString()) : (mm).toString();
    const fd = "good_" + [y, mm, "01"].join("_");
    global.good_folder = good_folder_root && path.resolve(good_folder_root, fd);

    //add not good folder
    const fd2 = "not_good_" + y;
    global.not_good_folder = not_good_folder_root && path.resolve(not_good_folder_root, fd2);

    path_will_scan = path_will_scan.concat(good_folder, good_folder_root, 
                                           not_good_folder_root, not_good_folder, 
                                           additional_folder);
    path_will_scan = await filterNonExist(path_will_scan);

    path_will_scan.push(getImgConverterCachePath());
    path_will_scan.push(getZipOutputCachePath());

    path_will_scan = _.uniq(path_will_scan);
    path_will_scan = await filterNonExist(path_will_scan);

    home_pathes = path_will_scan;

    return {
        home_pathes,
        path_will_scan
    };
}

function getImgConverterCachePath() {
    const imgConvertFolder = path.join(getRootPath(), userConfig.workspace_name, userConfig.img_convert_cache);
    return imgConvertFolder;
}

function getZipOutputCachePath() {
    return path.join(getRootPath(), userConfig.workspace_name, userConfig.zip_output_cache);
}

module.exports = {
    fullPathToUrl,
    generateContentUrl,
    getRootPath,
    filterNonExist,
    isExist,
    isDirectParent,
    isSub,
    getHomePath,
    getImgConverterCachePath,
    getZipOutputCachePath
};