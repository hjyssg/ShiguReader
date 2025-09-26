const _ = require('underscore');

const path = require('path');
const pathUtil = require("../utils/path-util");
const { getDirName } = pathUtil;


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

// module.exports.getAllCacheFilePathes = function () {
//     return _.keys(cacheDb.cacheFileToInfo);
// }


module.exports.updateStatToCacheDb = function (p, stat) {
    const { folderToFiles, cacheFileToInfo } = cacheDb;
    const fp = getDirName(p);
    folderToFiles[fp] = folderToFiles[fp] || [];
    folderToFiles[fp].push(path.basename(p));

    const statObj = {};
    statObj.isDir = stat.isDirectory();
    statObj.mtimeMs = stat.mtimeMs;
    statObj.size = Number(stat.size);

    cacheFileToInfo[p] = statObj;
}

module.exports.isFileInCache = function(filePath){
    return !!cacheDb.cacheFileToInfo[filePath];
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