const path = require('path');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
const fs = require('fs');
const isWindows = require('is-windows');
const _ = require('underscore');

const { isImage, isMusic, isVideo } = util;
const cache_folder_name = userConfig.cache_folder_name;
const pfs = require('promise-fs');

const rootPath = process.cwd() // path.join(__dirname, "..", "..");
const getRootPath = function () {
    return rootPath;
}

let a = process.cwd()

console.log(rootPath, a);

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

function parse_aji_path_config(fileContent, sepArr){
    let pathes = fileContent.toString().split('\n');
    pathes = pathes
        .map(e => e.trim().replace(/\n|\r/g, ""))
        .filter(pp => { return pp && pp.length > 0 && !pp.startsWith("#") && !pp.startsWith(";"); });
    pathes = _.uniq(pathes);

    const indexArr = sepArr.map(sep =>  {
       return pathes.findIndex(e => e.includes(sep));
    })

    const result = [];
    for(let ii = 0; ii < indexArr.length; ii++){
        const curIndex = indexArr[ii];
        const nextIndex = indexArr[ii+1];
        let part;
        if(nextIndex){
            part = pathes.slice(curIndex+1, nextIndex)
        }else {
            part = pathes.slice(curIndex+1);
        }
        result.push(part);
    }

    return result;
}

async function getHomePath() {
    const path_config_path = path.join(getRootPath(), "path-config.ini");
    const fContent1 = fs.readFileSync(path_config_path);
    const pathObj = parse_aji_path_config(fContent1, ["SCAN_AND_MONITOR_CHANGE", "ONLY_SCAN_ONCE"]);
    let path_will_scan = pathObj[0].concat(pathObj[1]);
    let path_not_watch = pathObj[1];

    const move_path_config_path = path.join(getRootPath(), "move-path-config.ini");
    const fContent2 = fs.readFileSync(move_path_config_path);
    const moveObj = parse_aji_path_config(fContent2, ["GOOD_FOLDER_ROOT", "NOT_GOOD_FOLDER_ROOT", "ADDITIONAL_FOLDER"]);

    global.good_folder_root = moveObj[0];
    global.not_good_folder_root= moveObj[1];
    global.additional_folder = moveObj[2]

    //less freedom for more noob-friendly
    const now = new Date();
    const y = now.getFullYear();
    let mm = now.getMonth() + 1;
    mm = (mm < 10) ? ("0" + (mm).toString()) : (mm).toString();
    const fd = "good_" + [y, mm, "01"].join("_");
    global.good_folder = path.resolve(userConfig.good_folder, fd);
    global.not_good_folder = path.resolve(global.not_good_folder_root, "_Compressed_" + y);

    path_will_scan = path_will_scan.concat(global.good_folder, global.good_folder_root, global.not_good_folder);
    path_will_scan = await filterNonExist(path_will_scan);

    //if user options, choose test samples
    const test_sample_path = path.resolve(rootPath, "test_samples");
    if (path_will_scan.length === 0 && (await isExist(test_sample_path))) {
        path_will_scan.push(test_sample_path);
    }

    //if not test samples, choose user folder
    if (path_will_scan.length === 0) {
        if (isWindows()) {
            const getDownloadsFolder = require('downloads-folder');
            path_will_scan.push(getDownloadsFolder());
        } else {
            //downloads-folder cause error on unix
            path_will_scan.push(`${process.env.HOME}/Downloads`);
        }
    }


    path_will_scan.push(getImgConverterCachePath());
    path_will_scan.push(getZipOutputCachePath());

    path_will_scan = _.uniq(path_will_scan);
    path_will_scan = await filterNonExist(path_will_scan);

    home_pathes = path_will_scan;
    const path_will_watch = path_will_scan.filter(e => !path_not_watch.includes(e));

    return {
        home_pathes,
        path_will_scan,
        path_will_watch
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