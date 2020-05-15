const _ = require('underscore');

const db = {
    //file path to file stats
    fileToInfo: {}
};


module.exports.getAllFilePathes = function(){
    return _.keys(db.fileToInfo);
};

module.exports.getFileToInfo = function(){
    return db.fileToInfo;
}

module.exports.setFileToInfo = function(obj){
    db.fileToInfo = obj;
}