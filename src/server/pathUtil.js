const path = require('path');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
const fs = require('fs');
const isWindows = require('is-windows');
const _ = require('underscore');

const { isImage, isMusic, isVideo } = util;
const cache_folder_name = userConfig.cache_folder_name;
const pfs = require('promise-fs');

const rootPath = path.join(__dirname, "..", "..");
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

async function getHomePath() {
    const path_config_path = path.join(getRootPath(), "src", "path-config.ini");
    //read text file 
    let pathes = fs.readFileSync(path_config_path).toString().split('\n');
    pathes = pathes
        .map(e => e.trim().replace(/\n|\r/g, ""))
        .filter(pp => { return pp && pp.length > 0 && !pp.startsWith("#") && !pp.startsWith(";"); });

    //add one more
    pathes = _.uniq(pathes);

    let path_will_scan = [];
    let path_not_watch = [];
    let onlyScan = false;
    pathes.forEach(line => {
        if (line.includes("ONLY_SCAN_ONCE")) {
            onlyScan = true;
        } else if (line.includes("SCAN_AND_MONITOR_CHANGE")) {
            onlyScan = false;
        } else {
            path_will_scan.push(line);
            if (onlyScan) {
                path_not_watch.push(line);
            }
        }
    })

    path_will_scan = path_will_scan.concat(userConfig.good_folder, userConfig.good_folder_root, userConfig.not_good_folder);
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