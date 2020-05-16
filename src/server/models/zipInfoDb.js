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
}

const has = module.exports.has = function(filePath){
    const data = getData(filePath);
    return !!data;
}

function getData(filePath){
    return zip_content_db.findOne({filePath: filePath});
}

const getPageNum = module.exports.getPageNum = function(filePath){
    if(has(filePath)){
        const contentInfo = getData(filePath);
        return +(contentInfo.pageNum) || 0;
    }else{
        return 0;
    }
}

const getMusicNum = module.exports.getMusicNum = function(filePath){
    if(has(filePath)){
        const contentInfo = getData(filePath);
        return +(contentInfo.musicNum) || 0;
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

            const entry = {
                pageNum,
                musicNum
            }

            fpToInfo[filePath] = entry;
        }
    }); 
    return fpToInfo;
}


module.exports.updateZipDb = function(filePath, pageNum, musicNum){
    //!!bug if shut the down the program, all data will be lost
    if(has(filePath)){
        let data = getData(filePath);
        data.filePath = filePath;
        data.pageNum = pageNum;
        data.musicNum = musicNum;
        zip_content_db.update(data);
    }else{
        zip_content_db.insert({
            filePath,
            pageNum,
            musicNum
        });
    }
}