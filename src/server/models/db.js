const _ = require('underscore');

const pathUtil = require("../pathUtil");
const path = require('path');
const serverUtil = require("../serverUtil");
const util = global.requireUtil();

const { getDirName } = serverUtil;
const { isImage, isCompress, isMusic } = util;

const nameParser = require('../../name-parser');
const namePicker = require("../../human-name-picker");


//file path to file stats
let fileToInfo =  {}
    
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


var sqlite3 = require('sqlite3').verbose();
var sqlDb = new sqlite3.Database(':memory:');
sqlDb.run("CREATE TABLE file_table (filePath TEXT NOT NULL PRIMARY KEY, dirPath TEXT, fileName TEXT, sTime INTEGER, " +
           "isDisplayableInExplorer BOOL, isDisplayableInOnebook BOOL, isCompress BOOL, isFolder BOOL)");

//todo: http://howto.philippkeller.com/2005/04/24/Tags-Database-schemas/
sqlDb.run("CREATE TABLE tag_table (filePath TEXT, tag VARCHAR(50), type VARCHAR(25), subtype VARCHAR(25))");

const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);

module.exports.getSQLDB = function(){
    return sqlDb;
}

function insertToTagTable(filePath, tag, type, subtype){
    subtype = subtype || "";
    if(!tag || tag.match(util.useless_tag_regex)){
        return;
    }
    sqlDb.run("INSERT OR REPLACE INTO tag_table(filePath, tag, type, subtype ) values(?, ?, ?, ?)",  filePath, tag, type, subtype);
}

module.exports.createSqlIndex = function(){
    sqlDb.run("CREATE INDEX IF NOT EXISTS filePath_index ON file_table (filePath)");
    sqlDb.run("CREATE INDEX IF NOT EXISTS dirPath_index ON file_table (dirPath)");
    sqlDb.run("CREATE INDEX IF NOT EXISTS tag_index ON tag_table (tag)");
}

const updateFileDb = function (filePath, statObj) {
    const fileName = path.basename(filePath);

    if(!statObj){
        console.warn("no statObj");
        statObj = {};
    }

    const isDisplayableInExplorer = util.isDisplayableInExplorer(filePath);
    const isDisplayableInOnebook = util.isDisplayableInOnebook(filePath);

    //set up tags
    const str = isDisplayableInExplorer ? fileName : getDirName(filePath);

    const temp = nameParser.parse(str) || {};
    const nameTags = namePicker.pick(str) || [];
    const musicTags = nameParser.parseMusicTitle(str) || [];
    const tags = _.uniq([].concat(temp.tags, temp.comiket , nameTags, musicTags));
    const authors = temp.authors || [];
    const group = temp.group || "";

    tags.forEach(t => {
        if(!authors.includes(t) && group !== t){

            //todo: add subtype
            //e.g comiket, parody
            if(temp.comiket === t){
                insertToTagTable(filePath, t, "tag", "comiket");
            }else{
                insertToTagTable(filePath, t, "tag", "parody");
            }
        }
    })

    authors.forEach(t => {
        insertToTagTable(filePath, t, "author");
    })

    insertToTagTable(filePath, group, "group")

    let aboutTimeA = nameParser.getDateFromParse(str);
    aboutTimeA = aboutTimeA && aboutTimeA.getTime();
    let fileTimeA = statObj.mtimeMs || aboutTimeA;

    const dirPath = path.dirname(filePath);

    // sqlDb.run("INSERT INTO file_table VALUES (?)", 
    // https://www.sqlitetutorial.net/sqlite-nodejs/insert/
    sqlDb.run("INSERT OR REPLACE INTO file_table(filePath, dirPath, fileName, sTime, " +
     "isDisplayableInExplorer, isDisplayableInOnebook, " + 
     "isCompress, isFolder ) values(?, ?, ?, ?, ?, ?, ?, ?)", 
    filePath, dirPath, fileName, fileTimeA,
    isDisplayableInExplorer, isDisplayableInOnebook, isCompress(fileName), statObj.isDir);
}

const pfs = require('promise-fs');
//!! same as file-iterator getStat()
module.exports.updateStatToDb = function (path, stat) {
    const statObj = {};

    if(!stat){
        //seems only happen on mac
        // console.log(path, "has no stat");
        //todo: mac img folder do not display
        pfs.stat(path).then(stat => {
            statObj.isFile = stat.isFile();
            statObj.isDir = stat.isDirectory();
            statObj.mtimeMs = stat.mtimeMs;
            statObj.mtime = stat.mtime;
            statObj.size = stat.size;
            fileToInfo[path] = statObj;
            updateFileDb(path, statObj);
        });
    }else{
        statObj.isFile = stat.isFile();
        statObj.isDir = stat.isDirectory();
        statObj.mtimeMs = stat.mtimeMs;
        statObj.mtime = stat.mtime;
        statObj.size = stat.size;
        fileToInfo[path] = statObj;
        updateFileDb(path, statObj);
    }
}

module.exports.deleteFromDb = function (path) {
    delete fileToInfo[path];
    sqlDb.run("DELETE FROM file_table where filePath = ?", path);
    sqlDb.run("DELETE FROM tag_table where filePath = ?", path);

}

module.exports.getImgFolderInfo = function (imgFolders) {
    const imgFolderInfo = {};
    _.keys(imgFolders).forEach(folder => {
        const files = imgFolders[folder];
        const len = files.length;
        let mtimeMs = 0, size = 0, totalImgSize = 0, pageNum = 0, musicNum = 0;
        files.forEach(file => {
            const tempInfo = getFileToInfo(file);
            if(tempInfo){
                mtimeMs += tempInfo.mtimeMs / len;
                size += tempInfo.size;

                if (isImage(file)) {
                    totalImgSize += tempInfo.size;
                }
            }

            if (isImage(file)) {
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
