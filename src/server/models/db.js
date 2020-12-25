const _ = require('underscore');
const dateFormat = require('dateformat');

const pathUtil = require("../pathUtil");
const stringHash = require("string-hash");
const path = require('path');
const serverUtil = require("../serverUtil");
const util = global.requireUtil();
const userConfig = global.requireUserConfig();

const { getDirName } = serverUtil;
const { isImage, isCompress, isMusic } = util;
const { generateContentUrl } = pathUtil;

const nameParser = require('../../name-parser');
const namePicker = require("../../human-name-picker");

const loki = require("lokijs");

//file path to file stats
let fileToInfo =  {}
    
const cacheDb = module.exports.cacheDb = {
    //a list of cache files folder -> files
    folderToFiles: {},
    //cache path to file stats
    cacheFileToInfo: {}
}

module.exports.getAllFilePathes = function () {
    return _.keys(fileToInfo);
};

const getFileToInfo = module.exports.getFileToInfo = function (filePath) {
    if (filePath) {
        return fileToInfo[filePath];
    } else {
        return fileToInfo;
    }
}

module.exports.getCacheFileToInfo = function () {
    return cacheDb.cacheFileToInfo;
}

module.exports.getAllCacheFilePathes = function () {
    return _.keys(cacheDb.cacheFileToInfo);
}

const sep = serverUtil.sep;

var sqlite3 = require('sqlite3').verbose();
var sqlDb = new sqlite3.Database(':memory:');
sqlDb.run("CREATE TABLE file_table (filePath TEXT NOT NULL PRIMARY KEY, fileName TEXT, isDisplayableInExplorer BOOL, isDisplayableInOnebook BOOL, tags TEXT, authors TEXT, _group TEXT )");

const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);


module.exports.getSQLDB = function(){
    return sqlDb;
}

const updateFileDb = function (filePath, insert) {
    const fileName = path.basename(filePath);

    const isDisplayableInExplorer = util.isDisplayableInExplorer(filePath);
    const isDisplayableInOnebook = util.isDisplayableInOnebook(filePath);

    //set up tags
    const str = isDisplayableInExplorer ? fileName : getDirName(filePath);

    const temp = nameParser.parse(str) || {};
    const nameTags = namePicker.pick(str) || [];
    const tags1 = temp.tags || [];
    tags1.concat(temp.comiket);
    const musisTags = nameParser.parseMusicTitle(str) || [];
    let tags = _.uniq(tags1.concat(nameTags, musisTags));

    tags = tags.join(sep);
    const authors = (temp.authors && temp.authors.join(sep)) || temp.author || "";
    const group = temp.group || "";

    // sqlDb.run("INSERT INTO file_table VALUES (?)", 
    // https://www.sqlitetutorial.net/sqlite-nodejs/insert/
    sqlDb.run("INSERT OR REPLACE INTO file_table(filePath, fileName, isDisplayableInExplorer, isDisplayableInOnebook, tags, authors, _group ) values(?, ?, ?, ?, ?, ?, ? )", 
    filePath, fileName, 
    isDisplayableInExplorer, isDisplayableInOnebook, 
    tags, authors, group);
}

const pfs = require('promise-fs');
//!! same as file-iterator getStat()
module.exports.updateStatToDb = function (path, stat) {
    const result = {};

    if(!stat){
        //seems only happen on mac
        // console.log(path, "has no stat");

        //todo: mac img folder do not display

        pfs.stat(path).then(stat => {
            result.isFile = stat.isFile();
            result.isDir = stat.isDirectory();
            result.mtimeMs = stat.mtimeMs;
            result.mtime = stat.mtime;
            result.size = stat.size;
            fileToInfo[path] = result;
            updateFileDb(path);
        });
    }else{
        result.isFile = stat.isFile();
        result.isDir = stat.isDirectory();
        result.mtimeMs = stat.mtimeMs;
        result.mtime = stat.mtime;
        result.size = stat.size;
        fileToInfo[path] = result;
        updateFileDb(path);
    }
}

module.exports.deleteFromDb = function (path) {
    delete fileToInfo[path];
    sqlDb.run("DELETE FROM file_table where filePath = ?", path);
}

module.exports.getImgFolderInfo = function (imgFolders) {
    const imgFolderInfo = {};
    _.keys(imgFolders).forEach(folder => {
        const files = imgFolders[folder];
        const len = files.length;
        let mtimeMs = 0, size = 0, totalImgSize = 0, pageNum = 0, musicNum = 0;
        files.forEach(file => {
            const tempInfo = getFileToInfo(file);
            if(!tempInfo){
                return;
            }

            mtimeMs += tempInfo.mtimeMs / len;
            size += tempInfo.size;

            if (isImage(file)) {
                totalImgSize += tempInfo.size;
                pageNum++;
            } else if (isMusic(file)) {
                musicNum++;
            }
        })

        //!! same as file-iterator getStat()
        imgFolderInfo[folder] = {
            isFile: false,
            isDir: true,
            mtimeMs,
            mtime: mtimeMs,
            size,
            totalImgSize,
            pageNum,
            musicNum
        };
    })

    return imgFolderInfo;
}

//---------------------------------------------cache db---------------------


//  outputPath is the folder name
module.exports.getCacheFiles = function (outputPath) {
    //in-memory is fast
    const single_cache_folder = path.basename(outputPath);
    if (cacheDb.folderToFiles[single_cache_folder] && cacheDb.folderToFiles[single_cache_folder].length > 0) {
        return generateContentUrl(cacheDb.folderToFiles[single_cache_folder], outputPath);
    }
    return null;
}

module.exports.getCacheOutputPath = function (cachePath, zipFilePath) {
    let outputFolder;
    outputFolder = path.basename(zipFilePath, path.extname(zipFilePath));
    if (!userConfig.readable_cache_folder_name) {
        outputFolder = stringHash(zipFilePath).toString();
    } else {
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
        mdate.setMilliseconds(0);
        mdate.setSeconds(0);
        mdate.setMinutes(0);
        mdate.setHours(0);
        const mstr = dateFormat(mdate, "yyyy-mm-dd") // mdate.getTime();
        const fstr = (stat.size / 1000 / 1000).toFixed();
        outputFolder = outputFolder + `${mstr} ${fstr}`;
    }
    return path.join(cachePath, outputFolder);
}

//!! same as file-iterator getStat()
module.exports.updateStatToCacheDb = function (p, stats) {
    const { folderToFiles, cacheFileToInfo } = cacheDb;
    const fp = getDirName(p);
    folderToFiles[fp] = folderToFiles[fp] || [];
    folderToFiles[fp].push(path.basename(p));

    cacheFileToInfo[p] = stats;
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