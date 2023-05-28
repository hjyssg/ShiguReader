const _ = require('underscore');
const pathUtil = require("../pathUtil");
const { getDirName } = pathUtil;
const path = require('path');
const serverUtil = require("../serverUtil");
const util = global.requireUtil();
const { isImage, isCompress, isMusic, isVideo } = util;
const pfs = require('promise-fs');


const nameParser = require('../../name-parser');
const namePicker = require("../../human-name-picker");


//file path to file stats
// 这个设计有点傻，应该并到sql。我当时刚学sql，不自信
const fileToInfo = {};

const getFileToInfo = module.exports.getFileToInfo = function (filePath) {
    if (filePath) {
        return fileToInfo[filePath];
    } else {
        return fileToInfo;
    }
}

let sqlDb;
module.exports.init = async ()=> {
    const dbCommon = require("./dbCommon");
    sqlDb = dbCommon.getSQLInstance(':memory:');
    // 用file的话，init的insertion太慢了

    // 提升少量性能
    await sqlDb.runSync( `
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF; ` );

    await sqlDb.runSync(`
        DROP TABLE IF EXISTS file_table;
        DROP TABLE IF EXISTS tag_table;
        DROP TABLE IF EXISTS scan_path_table;`);

    await sqlDb.runSync(`CREATE TABLE file_table (
                            filePath TEXT NOT NULL PRIMARY KEY, 
                            dirPath TEXT, 
                            fileName TEXT, 
                            sTime INTEGER, 
                            isDisplayableInExplorer BOOL, 
                            isDisplayableInOnebook BOOL, 
                            isCompress BOOL, 
                            isVideo BOOL,
                            isFolder BOOL);`);
    await sqlDb.runSync(`CREATE TABLE tag_table (
                            filePath TEXT NOT NULL, 
                            tag VARCHAR(50) NOT NULL, 
                            type VARCHAR(25),
                            subtype VARCHAR(25), 
                            isCompress BOOL,
                            isFolder BOOL,
                            PRIMARY KEY (filePath, tag, type) 
                        )`);
    await sqlDb.runSync(`CREATE TABLE scan_path_table (filePath TEXT NOT NULL, type VARCHAR(25))`);

    await sqlDb.runSync(` CREATE VIEW zip_view  AS SELECT * FROM file_table WHERE isCompress = true `)
    await sqlDb.runSync(` CREATE VIEW author_view  AS SELECT * FROM tag_table 
                            WHERE type='author' AND (isCompress = true OR isFolder = true) `)
    await sqlDb.runSync(` CREATE VIEW tag_view  AS SELECT * FROM tag_table 
                            WHERE type='tag' AND (isCompress = true OR isFolder = true)  `)

}

module.exports.getSQLDB = function () {
    return sqlDb;
}

module.exports.createSqlIndex = function () {
    sqlDb.run(` CREATE INDEX IF NOT EXISTS dirPath_index ON file_table (dirPath);
                CREATE INDEX IF NOT EXISTS tag_index ON tag_table (tag);
                CREATE INDEX IF NOT EXISTS tag_filePath_index ON tag_table (filePath); `);
}

module.exports.insertScanPath = async function(scan_path){
    const stmt = sqlDb.prepare('INSERT INTO scan_path_table(filePath, type) VALUES (?, ?)');
    for(let pp of scan_path){
        stmt.run(pp, "");
    }
}

module.exports.getAllScanPath = async function(){
    const sql = `SELECT filePath FROM scan_path_table `;
    const temp = await sqlDb.allSync(sql);
    return temp.map(e => e.filePath);
}

module.exports.getAllFilePathes = async function (sql_condition) {
    // return _.keys(fileToInfo);
    const sql = `SELECT filePath FROM file_table ` + sql_condition;
    const temp = await sqlDb.allSync(sql);
    return temp.map(e => e.filePath);
};

let stmt_tag_insert ;
let stmt_file_insert;
const updateFileDb = function (filePath, statObj) {
    console.assert(!!filePath)
    const fileName = path.basename(filePath);

    if (!statObj) {
        console.warn("[updateFileDb] no statObj");
        statObj = {};
    }

    stmt_tag_insert = stmt_tag_insert || sqlDb.prepare(`
            INSERT OR REPLACE INTO tag_table (filePath, tag, type, subtype, isCompress, isFolder )
            values (?, ?, ?, ?, ?, ?)`);

    stmt_file_insert = stmt_file_insert || sqlDb.prepare(`
        INSERT OR REPLACE INTO file_table (filePath, dirPath, fileName, sTime, 
        isDisplayableInExplorer, isDisplayableInOnebook, 
        isCompress, isVideo, isFolder ) values(?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const isCompressFile = isCompress(fileName);
    const isVideoFile = isVideo(fileName);
    const isFolder = statObj.isDir;
    const isDisplayableInExplorer = util.isDisplayableInExplorer(fileName);
    const isDisplayableInOnebook = util.isDisplayableInOnebook(fileName);
    //set up tags
    const str = isDisplayableInExplorer ? fileName : getDirName(filePath);

    const temp = nameParser.parse(str) || {};
    const nameTags = namePicker.pick(str) || [];
    const musicTags = nameParser.parseMusicTitle(str) || [];
    const tags = _.uniq([].concat(temp.tags, temp.comiket, nameTags, musicTags));
    const authors = temp.authors || [];
    const group = temp.group || "";

    
    // tag插入sql
    let tags_rows = [];
    tags.forEach(t => {
        if (!authors.includes(t) && group !== t) {
            if (temp.comiket === t) {
                tags_rows.push([filePath, t, "tag", "comiket", isCompressFile, isFolder]);
            } else {
                tags_rows.push([filePath, t, "tag", "parody", isCompressFile, isFolder]);
            }
        }
    })
    authors.forEach(t => {
        tags_rows.push([filePath, t, "author", "", isCompressFile, isFolder]);
    })
    tags_rows.push([filePath, group, "group", "", isCompressFile, isFolder]);
    tags_rows = tags_rows.filter(e => e[1] && !e[1].match(util.useless_tag_regex))
    // do batch insertion
    if(tags_rows.length > 0){
        for(const row of tags_rows){
            if(row[0] && row[1]){
                stmt_tag_insert.run(...row);
            }
        }
    }

    //file_table插入
    let aboutTimeA = nameParser.getDateFromParse(str);
    aboutTimeA = aboutTimeA && aboutTimeA.getTime();
    let fileTimeA = statObj.mtimeMs || aboutTimeA;
    const dirPath = path.dirname(filePath);
    // https://www.sqlitetutorial.net/sqlite-nodejs/insert/
    stmt_file_insert.run(filePath, dirPath, fileName, fileTimeA,
        isDisplayableInExplorer, isDisplayableInOnebook, isCompressFile, isVideoFile, isFolder);
}

module.exports.updateStatToDb = async function (filePath, stat) {
    const statObj = {};
    if (!stat) {
        //seems only happen on mac
        stat = await pfs.stat(filePath)
    }

    statObj.isDir = stat.isDirectory();
    statObj.mtimeMs = stat.mtimeMs;
    statObj.size = stat.size;
    fileToInfo[filePath] = statObj;
    updateFileDb(filePath, statObj);
}

module.exports.deleteFromDb = function (filePath) {
    delete fileToInfo[filePath];
    sqlDb.run("DELETE FROM file_table where filePath = ?", filePath);
    sqlDb.run("DELETE FROM tag_table where filePath = ?", filePath);
}

module.exports.getImgFolderInfo = function (imgFolders) {
    const imgFolderInfo = {};
    _.keys(imgFolders).forEach(folder => {
        const files = imgFolders[folder];
        const len = files.length;
        let mtimeMs = 0, size = 0, totalImgSize = 0, 
            pageNum = 0, musicNum = 0, videoNum = 0;

        files.forEach(file => {
            const tempInfo = getFileToInfo(file);
            if (tempInfo) {
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
            } else if(isVideo(file)){
                videoNum++;
            }
        });

        const _imgs = files.filter(isImage);
        serverUtil.sortFileNames(_imgs);
        const thumbnail = _imgs[0]

        imgFolderInfo[folder] = {
            mtimeMs,
            size,
            totalImgSize,
            pageNum,
            musicNum,
            videoNum,
            thumbnail
        };
    })

    return imgFolderInfo;
}
