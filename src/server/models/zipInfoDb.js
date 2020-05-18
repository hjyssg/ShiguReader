const loki = require("lokijs");

const util = require("../../util");
const { isCompress } = util;

let loki_db;
let zip_content_db;

const _ = require('underscore');


module.exports.init = function(path){
    loki_db = new loki(path, {
        autoload: true,
        autoloadCallback : databaseInitialize,
        autosave: true, 
        autosaveInterval: 4000
    });
}

// implement the autoloadback referenced in loki constructor
function databaseInitialize() {
    zip_content_db = loki_db.getCollection("zipInfo");
    if (zip_content_db === null) {
      zip_content_db = loki_db.addCollection("zipInfo", { indices: ['filePath'] });
    }
    var entryCount = zip_content_db.count();
    console.log("[zipInfoDb] number of entries in database : " + entryCount);
}

const has = module.exports.has = function(filePath){
    const data = getData(filePath);
    return !!data;
}

function getData(filePath){
    return zip_content_db && zip_content_db.findOne({filePath: filePath});
}

//how many image files
const getPageNum = module.exports.getPageNum = function(filePath){
    if(has(filePath)){
        const contentInfo = getData(filePath);
        return +(contentInfo.pageNum) || 0;
    }else{
        return 0;
    }
}

//how many music files
const getMusicNum = module.exports.getMusicNum = function(filePath){
    if(has(filePath)){
        const contentInfo = getData(filePath);
        return +(contentInfo.musicNum) || 0;
    }else{
        return 0;
    }
}

//get image file in total
const getTotalImgSize= module.exports.getTotalImgSize = function(filePath){
    if(has(filePath)){
        const contentInfo = getData(filePath);
        return +(contentInfo.totalImgSize) || 0;
    }else{
        return 0;
    }
}


module.exports.getZipInfo = function(filePathes){
    const fpToInfo = {};
    
    filePathes.forEach(filePath => {
        if(isCompress(filePath) && has(filePath)){
            let pageNum = getPageNum(filePath);
            const musicNum = getMusicNum(filePath);
            const totalImgSize = getTotalImgSize(filePath);

            const entry = {
                pageNum,
                musicNum,
                totalImgSize
            }

            fpToInfo[filePath] = entry;
        }
    }); 
    return fpToInfo;
}

module.exports.deleteFromZipDb = function(filePath){
    if(!zip_content_db){
        return;
    }

    if(has(filePath)){
        let data = getData(filePath);
        zip_content_db.remove(data);
    }
}

module.exports.updateZipDb = function(filePath, info){
    if(!zip_content_db){
        return;
    }

    const { pageNum, musicNum, totalImgSize } = info;

    //!!bug if shut the down the program, all data will be lost
    if(has(filePath)){
        let data = getData(filePath);
        data.filePath = filePath;
        data.pageNum = pageNum;
        data.musicNum = musicNum;
        data.totalImgSize = totalImgSize;
        zip_content_db.update(data);
    }else{
        zip_content_db.insert({
            filePath,
            pageNum,
            totalImgSize,
            musicNum
        });
    }
}
