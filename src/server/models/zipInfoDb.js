const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;

const util = require("../../util");
const { isCompress } = util;

let zip_content_db;
let AllInfo = zip_content_db.getData("/");

module.exports.init = function(path){
    zip_content_db = new JsonDB(new Config(path, true, true, '/'));
}

const has = module.exports.has = function(filePath){
    return !!getData(filePath);
}

function getData(filePath){
    return AllInfo[filePath];
}

const getPageNum = module.exports.getPageNum = function(filePath){
    const contentInfo = getData(filePath);
    if(contentInfo){
        return +(contentInfo.pageNum) || 0;
    }else{
        return 0;
    }
}

const getMusicNum = module.exports.getMusicNum = function(filePath){
    const contentInfo = getData(filePath);
    if(contentInfo){
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
    const newAllInfo = zip_content_db.getData("/");
    newAllInfo[filePath] = {
        pageNum: pageNum,
        musicNum: musicNum
    };
    AllInfo = newAllInfo;
    zip_content_db.push("/", newAllInfo);
}