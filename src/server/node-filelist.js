'use strict';

var fs              = require("fs");
var path            = require("path");
var async           = require("async");
var readExtName     = [];
var retFileArr      = [];
var callback_Function;
var q;
var option;

function checkFileIsDirectory(fileObj,callback) {

    if(fileObj.file == "noneFile" || !isExistFile(fileObj.file)){
        callback();
        return;
    }

    if (fs.statSync(fileObj.file).isDirectory()) {
        fs.readdir(fileObj.file, function(err, files) {
            for (var i = 0; i < files.length; i++) {
                q.push({"file":path.join(fileObj.file,files[i]) }, function(){} );
            }
            if(files.length==0){
                q.push({"file":"noneFile"}, function(){} );
            }
            callback();
        });
    }else{
        readFile(fileObj.file, callback);
    }
}

function isExistFile(file) {
  try {
    fs.statSync(file);
    return true
  } catch(err) {
    if(err.code === 'ENOENT') return false
  }
}

function readFile(inFilePath, inCallback){
    if( isReadPermission(inFilePath) ){
        if(option && option.isStats){
            fs.stat(inFilePath, function(err,stats){
                if(!err){
                    retFileArr.push({
                        "path" : inFilePath ,
                        "stats" : stats
                    });
                    inCallback();
                }else{
                    console.log(err);
                    inCallback();
                }
            });
        }else{
            retFileArr.push({
                "path" : inFilePath
            });
            inCallback();
        }
    }else{
        inCallback();
    }
}

function initQueue(){
    q = null;
    q = async.queue(function(fileObj, callback) {
        checkFileIsDirectory(fileObj,callback);
    }, 1);

    q.drain = function() {
        qDrain();
    }
}

function qDrain(){
    readComplete();
    initVar();
}

function saveReadExtName(inOption){
    if(!inOption || !inOption.ext || inOption.ext == "" ){
        readExtName = [];
    }else{
        readExtName = inOption.ext.replace(/^\|/,"").replace(/\|$/,"").split("|");
    }
}

function isReadPermission(inFile){
    if(readExtName.length == 0)return true;
    var flg = false;
    for(var i=0; i<readExtName.length; i++){
        if("."+readExtName[i].replace(".","") == getExtName(inFile)){
            flg = true;
            break;
        }
    }
    return flg;
}

function getExtName(inFile){
    return path.extname( path.normalize(inFile) );
}

function readComplete(){
    callback_Function(retFileArr);
};

function initVar(){
    readExtName         = [];
    retFileArr          = [];
    callback_Function   = null;
    q                   = null;
    initQueue();
}

module.exports.read = function(inFileList, inOption ,inCallback_Func){
    initVar();
    callback_Function = inCallback_Func;
    option = inOption;
    saveReadExtName(inOption);

    for(var i=0; i<inFileList.length; i++){
        q.push({"file": path.resolve(inFileList[i]) }, function() {});
    }
};

module.exports.getFileExtName = function(inFile){
    return getExtName(inFile);
};