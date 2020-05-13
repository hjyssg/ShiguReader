const _ = require('underscore');

const db = {
    //file path to file stats
    fileToInfo: {},
    //hash to any string
    hashTable: {},
};

module.exports.hashTable = db.hashTable;

module.exports.getAllFilePathes = function(){
    return _.keys(db.fileToInfo);
};

module.exports.getFileToInfo = function(){
    return db.fileToInfo;
}

module.exports.setFileToInfo = function(obj){
    db.fileToInfo = obj;
}