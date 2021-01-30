const _ = require('underscore');

const pathUtil = require("../pathUtil");
const path = require('path');
const serverUtil = require("../serverUtil");
const util = global.requireUtil();

const { getDirName } = serverUtil;
const { generateContentUrl } = pathUtil;



//---------------------------------------------cache db---------------------
const cacheDb = module.exports.cacheDb = {
    //a list of cache files folder -> files
    folderToFiles: {},
    //cache path to file stats
    cacheFileToInfo: {}
}

module.exports.getCacheFileToInfo = function () {
    return cacheDb.cacheFileToInfo;
}

module.exports.getAllCacheFilePathes = function () {
    return _.keys(cacheDb.cacheFileToInfo);
}

//  outputPath is the folder name
module.exports.getCacheFiles = function (outputPath) {
    //in-memory is fast
    const single_cache_folder = path.basename(outputPath);
    if (cacheDb.folderToFiles[single_cache_folder] && cacheDb.folderToFiles[single_cache_folder].length > 0) {
        return generateContentUrl(cacheDb.folderToFiles[single_cache_folder], outputPath);
    }
    return null;
}



//!! same as file-iterator getStat()
module.exports.updateStatToCacheDb = function (p, stats) {
    const { folderToFiles, cacheFileToInfo } = cacheDb;
    const fp = getDirName(p);
    folderToFiles[fp] = folderToFiles[fp] || [];
    folderToFiles[fp].push(path.basename(p));

    cacheFileToInfo[p] = stats;
}

module.exports.isFileInCache = function(filePath){
    const { folderToFiles, cacheFileToInfo } = cacheDb;
    return !!cacheFileToInfo[filePath];
}

module.exports.deleteFromCacheDb = function (p) {
    const { folderToFiles, cacheFileToInfo } = cacheDb;
    const fp = getDirName(p);
    if (folderToFiles[fp]) {
        const index = folderToFiles[fp].indexOf(path.basename(p));
        folderToFiles[fp].splice(index, 1);
    }
    delete cacheFileToInfo[p];
}