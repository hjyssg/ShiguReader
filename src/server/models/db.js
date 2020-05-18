const _ = require('underscore');
const chokidar = require('chokidar');
const dateFormat = require('dateformat');

const pathUtil = require("../pathUtil");
const stringHash = require("string-hash");
const path = require('path');
const serverUtil = require("../serverUtil");
const util = require("../../util");
const userConfig = require('../../user-config');

const {getDirName} = serverUtil;
const { isImage, isCompress, isMusic, isDisplayableInExplorer, isDisplayableInOnebook } = util;
const {   generateContentUrl } = pathUtil;


const db = {
    //file path to file stats
    fileToInfo: {}
};

const cacheDb = module.exports.cacheDb = {
    //a list of cache files folder -> files
    folderToFiles: {},
    //cache path to file stats
    cacheFileToInfo: {}
}

const getAllFilePathes = module.exports.getAllFilePathes = function(){
    return _.keys(db.fileToInfo);
};

const getFileToInfo = module.exports.getFileToInfo = function(filePath){
    if(filePath){
        return db.fileToInfo[filePath];
    }else{
        return db.fileToInfo;
    }
}

module.exports.getCacheFileToInfo = function(){
    return cacheDb.cacheFileToInfo;
}

module.exports.getAllCacheFilePathes = function(){
    return _.keys(cacheDb.cacheFileToInfo);
}

module.exports.initFileToInfo = function(obj){
    db.fileToInfo = obj;
    getAllFilePathes().forEach(e => {
        const fp = path.basename(e);
        if (isDisplayableInExplorer(fp)) {
            preParse(fp);
        }
    })
}

module.exports.initCacheDb = function(pathes, infos){
    (pathes||[]).forEach(p => {
        const fp =  getDirName(p);
        cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
        cacheDb.folderToFiles[fp].push(path.basename(p));
    });
    
    cacheDb.cacheFileToInfo = infos;
}


function shouldWatchForCache(p){
    const ext = path.extname(p).toLowerCase();
    if (!ext ||  isDisplayableInOnebook(ext)) {
        return true;
    }
    return false;
}

function shouldIgnoreForCache(p){
    return !shouldWatchForCache(p);
}

function preParse(str){
    //will save in memory
    serverUtil.parse(str);
}

//!! same as file-iterator getStat()
const updateStatToDb = module.exports.updateStatToDb = function(path, stat){
    const result = {};
    result.isFile = stat.isFile();
    result.isDir = stat.isDirectory();
    result.mtimeMs = stat.mtimeMs;
    result.mtime = stat.mtime;
    result.size = stat.size;
    db.fileToInfo[path] = result;
}

function shouldWatchForOne(p){
    const ext = path.extname(p).toLowerCase();
    if (!ext ||  isDisplayableInExplorer(ext) ) {
        return true;
    }
    return false;
}

function shouldIgnoreForOne(p){
    return !shouldWatchForOne(p);
}


module.exports.setUpFileWatch = function(home_pathes, cache_folder_name){
    //todo ignore image
    const watcher = chokidar.watch(home_pathes, {
        ignored: shouldIgnoreForOne,
        ignoreInitial: true,
        persistent: true,
        ignorePermissionErrors: true
    });

    const addCallBack = (path, stats) => {
        preParse(path);
        updateStatToDb(path, stats);
    };

    const deleteCallBack = path => {
        //update dn
        delete db.fileToInfo[path];
    };

    watcher
        .on('add', addCallBack)
        .on('unlink', deleteCallBack);
    
    // More possible events.
    watcher
        .on('addDir', addCallBack)
        .on('unlinkDir', deleteCallBack);

    //also for cache files
    const cacheWatcher = chokidar.watch(cache_folder_name, {
        ignored: shouldIgnoreForCache,
        persistent: true,
        ignorePermissionErrors: true,
        ignoreInitial: true,
    });

    cacheWatcher
        .on('unlinkDir', p => {
            const fp =  path.dirname(p);
            cacheDb.folderToFiles[fp] = undefined;
        });

    cacheWatcher
        .on('add', (p, stats) => {
            const fp =  getDirName(p);
            cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
            cacheDb.folderToFiles[fp].push(path.basename(p));

            stats.isFile = stats.isFile();
            stats.isDir = stats.isDirectory();
            cacheDb.cacheFileToInfo[p] = stats;
        })
        .on('unlink', p => {
            const fp =  getDirName(p);
            cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
            const index = cacheDb.folderToFiles[fp].indexOf(path.basename(p));
            cacheDb.folderToFiles[fp].splice(index, 1);

            delete cacheDb.cacheFileToInfo[p];
        });

    return {
        watcher,
        cacheWatcher
    };
}



//  outputPath is the folder name
module.exports.getCacheFiles = function(outputPath) {
    //in-memory is fast
    const single_cache_folder = path.basename(outputPath);
    if(cacheDb.folderToFiles[single_cache_folder] && cacheDb.folderToFiles[single_cache_folder].length > 0){
        return generateContentUrl(cacheDb.folderToFiles[single_cache_folder], outputPath);
    }
    return null;
}

module.exports.getCacheOutputPath = function (cachePath, zipFilePath) {
    let outputFolder;
    outputFolder = path.basename(zipFilePath, path.extname(zipFilePath));
    if(!userConfig.readable_cache_folder_name){
        outputFolder = stringHash(zipFilePath).toString();
    }else{
        outputFolder = outputFolder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>/]/gi, '');
    }
    outputFolder = outputFolder.trim();

    let stat = getFileToInfo(zipFilePath);
    if (!stat) {
        //should have stat in fileToInfo
        //but chokidar is not reliable
        //getCacheOutputPath comes before chokidar callback
        console.warn("[getCacheOutputPath] no stat", zipFilePath);
    } else {
        const mdate = new Date(stat.mtimeMs);
        const mstr = dateFormat(mdate, "yyyy-mm-dd");
        const fstr = (stat.size/1000/1000).toFixed();
        outputFolder = outputFolder+ `${mstr} ${fstr} `;
    }
    return path.join(cachePath, outputFolder);
}