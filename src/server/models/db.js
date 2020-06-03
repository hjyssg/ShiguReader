const _ = require('underscore');
const dateFormat = require('dateformat');

const pathUtil = require("../pathUtil");
const stringHash = require("string-hash");
const path = require('path');
const serverUtil = require("../serverUtil");
const util = global.requireUtil();
const userConfig = global.requireUserConfig();

const {getDirName} = serverUtil;
const { isImage, isCompress, isMusic, isDisplayableInExplorer, isDisplayableInOnebook } = util;
const { generateContentUrl } = pathUtil;

const nameParser = require('../../name-parser');
const namePicker = require("../../human-name-picker");

const loki = require("lokijs");
const file_db = new loki();
const file_collection = file_db.addCollection("fileTable", { 
    indices: ['filePath', "fileName", "tags", "authors"],
    unique: ['filePath'] 
});

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

module.exports.getAllFilePathes = function(){
    return _.keys(db.fileToInfo);
};

const loopEachFileInfo = module.exports.loopEachFileInfo = function(callback){
    for(let filePath in db.fileToInfo){
        if(db.fileToInfo.hasOwnProperty(filePath)){
            callback(filePath, db.fileToInfo[filePath]);
        }
    }
}

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
    loopEachFileInfo(e => {
        updateFileDb(e)
    })
}

function getData(filePath){
    return file_collection.findOne({filePath: filePath});
}

const has = module.exports.has = function(filePath){
    const data = getData(filePath);
    return !!data;
}

const deleteFromFileDb = function(filePath){
    if(has(filePath)){
        let data = getData(filePath);
        file_collection.remove(data);
    }
}

const sep = module.exports.strSep = "-----";

const updateFileDb = function(filePath){
    const fileName = path.basename(filePath);
    
    let data = getData(filePath) || {};
    data.filePath = filePath;
    data.isDisplayableInExplorer = isDisplayableInExplorer(filePath);
    data.fileName  = fileName;

    //set up tags
    const temp = nameParser.parse(fileName) || {};
    const nameTags = namePicker.pick(fileName)||[];
    const tags1 = temp.tags || [];
    const musisTags = nameParser.parseMusicTitle(fileName)||[];
    let tags = _.uniq(tags1.concat(nameTags, musisTags));

    data.tags = tags.join(sep);
    data.authors = (temp.authors && temp.authors.join(sep)) || temp.author || "";
    data.group = temp.group;

    if(has(filePath)){
        file_collection.update(data);
    }else{
        file_collection.insert(data);
    }
}

module.exports.getFileCollection = function(){
    return file_collection;
}


//!! same as file-iterator getStat()
module.exports.updateStatToDb =  function(path, stat){
    const result = {};
    result.isFile = stat.isFile();
    result.isDir = stat.isDirectory();
    result.mtimeMs = stat.mtimeMs;
    result.mtime = stat.mtime;
    result.size = stat.size;
    db.fileToInfo[path] = result;

    updateFileDb(path);
}

module.exports.deleteFromDb = function(path){
    delete db.fileToInfo[path];
    deleteFromFileDb(path);
}

//---------------------------------------------cache db---------------------

// module.exports.initCacheDb = function(pathes, infos){
//     (pathes||[]).forEach(p => {
//         const fp =  getDirName(p);
//         cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
//         cacheDb.folderToFiles[fp].push(path.basename(p));
//     });
    
//     cacheDb.cacheFileToInfo = infos;
// }

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
        const mstr = mdate.getTime();
        const fstr = (stat.size/1000/1000).toFixed();
        outputFolder = outputFolder+ `${mstr} ${fstr}`;
    }
    return path.join(cachePath, outputFolder);
}

//!! same as file-iterator getStat()
module.exports.updateStatToCacheDb =  function(p, stats){
    const {folderToFiles, cacheFileToInfo} = cacheDb;
    const fp =  getDirName(p);
    folderToFiles[fp] = folderToFiles[fp] || [];
    folderToFiles[fp].push(path.basename(p));

    cacheFileToInfo[p] = stats;
}

module.exports.deleteFromCacheDb = function(p){
    const {folderToFiles, cacheFileToInfo} = cacheDb;
    const fp =  getDirName(p);
    if(folderToFiles[fp]){
        const index = folderToFiles[fp].indexOf(path.basename(p));
        folderToFiles[fp].splice(index, 1);
    }
    delete cacheFileToInfo[p];
}