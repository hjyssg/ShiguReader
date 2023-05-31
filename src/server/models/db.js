const _ = require('underscore');
const pathUtil = require("../pathUtil");
const { getDirName } = pathUtil;
const path = require('path');
const serverUtil = require("../serverUtil");
const util = global.requireUtil();
const _util = require('util');
const { isImage, isCompress, isMusic, isVideo, getCurrentTime } = util;
const pfs = require('promise-fs');
const nameParser = require('../../name-parser');
const namePicker = require("../../human-name-picker");


// file path to file stats
// 简单重复查询，性能是sql的30倍
const fileToInfo = {};
const getFileToInfo = function (filePath) {
    return fileToInfo[filePath];
}

let stmd_single_file;
const getFileToInfoAsync = async (filePath) => {
    // const sql = ;
    // return await sqldb.getSync(sql, [filePath]);
    if(!stmd_single_file){
        stmd_single_file =  sqldb.prepare(` SELECT * FROM file_table WHERE filePath = ?`)
        stmd_single_file.getSync = _util.promisify(stmd_single_file.get).bind(stmd_single_file);
    }
    return stmd_single_file.getSync(filePath)
}

let statement_cache = {};
module.exports.doSmartAllSync = async (sql, params) =>{
    // 可能是sql文都比较简单，性能提升大约只有百分之三。
    if(!statement_cache[sql]){
        const statement = sqldb.prepare(sql);
        statement.allSync = _util.promisify(statement.all).bind(statement);
        statement_cache[sql] = statement;
    }
    return await statement_cache[sql].allSync(params);
}

let sqldb;
module.exports.init = async ()=> {
    const dbCommon = require("./dbCommon");
    sqldb = dbCommon.getSQLInstance(':memory:');
    // 用file的话，init的insertion太慢了

    // 提升少量性能
    await sqldb.runSync( `
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF; ` );

    await sqldb.runSync(`
        DROP TABLE IF EXISTS file_table;
        DROP TABLE IF EXISTS tag_table;
        DROP TABLE IF EXISTS scan_path_table;`);

    await sqldb.runSync(`CREATE TABLE file_table (
                            filePath TEXT NOT NULL PRIMARY KEY, 
                            dirName TEXT, 
                            dirPath TEXT, 
                            fileName TEXT, 
                            mTime INTEGER, 
                            size INTEGER, 
                            isDisplayableInExplorer BOOL, 
                            isDisplayableInOnebook BOOL, 
                            isCompress BOOL, 
                            isVideo BOOL,
                            isFolder BOOL);`);
    await sqldb.runSync(`CREATE TABLE tag_table (
                            filePath TEXT NOT NULL, 
                            tag VARCHAR(50) NOT NULL , 
                            type VARCHAR(25) CHECK(type IN ('tag', 'author', 'group')),
                            subtype VARCHAR(25)  CHECK(subtype IN ('comiket', 'name', 'parody', 'author', 'group')) , 
                            isCompress BOOL,
                            isFolder BOOL,
                            PRIMARY KEY (filePath, tag, type) 
                        )`);
    await sqldb.runSync(`CREATE TABLE scan_path_table (filePath TEXT NOT NULL, type VARCHAR(25))`);

    await sqldb.runSync(` CREATE VIEW zip_view  AS SELECT * FROM file_table WHERE isCompress = true `)
    await sqldb.runSync(` CREATE VIEW author_view  AS SELECT * FROM tag_table 
                            WHERE type='author' AND (isCompress = true OR isFolder = true) `)
    await sqldb.runSync(` CREATE VIEW tag_view  AS SELECT * FROM tag_table 
                            WHERE type='tag' AND (isCompress = true OR isFolder = true)  `)

}

module.exports.getSQLDB = function () {
    return sqldb;
}

module.exports.createSqlIndex = async function () {
    await sqldb.runSync(` CREATE INDEX IF NOT EXISTS ft_filePath_index ON file_table (filePath); `);
    await sqldb.runSync(` CREATE INDEX IF NOT EXISTS ft_fileName_index ON file_table (fileName); `);
    await sqldb.runSync(` CREATE INDEX IF NOT EXISTS ft_dirPath_index ON file_table (dirPath); `);
    await sqldb.runSync(` CREATE INDEX IF NOT EXISTS ft_dirName_index ON file_table (dirName); `);

    await sqldb.runSync(` CREATE INDEX IF NOT EXISTS tag_index ON tag_table (tag); `);
    await sqldb.runSync(` CREATE INDEX IF NOT EXISTS tag_filePath_index ON tag_table (filePath); `);
}

module.exports.insertScanPath = async function(scan_path){
    const stmt = sqldb.prepare('INSERT INTO scan_path_table(filePath, type) VALUES (?, ?)');
    for(let pp of scan_path){
        stmt.run(pp, "");
    }
}

module.exports.getAllScanPath = async function(){
    const sql = `SELECT filePath FROM scan_path_table `;
    const temp = await sqldb.allSync(sql);
    return temp.map(e => e.filePath);
}

module.exports.getAllFilePathes = async function (sql_condition) {
    // return _.keys(fileToInfo);
    const sql = `SELECT filePath FROM file_table ` + sql_condition;
    const temp = await sqldb.allSync(sql);
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

    stmt_tag_insert = stmt_tag_insert || sqldb.prepare(`
            INSERT OR REPLACE INTO tag_table (filePath, tag, type, subtype, isCompress, isFolder )
            values (?, ?, ?, ?, ?, ?)`);

    stmt_file_insert = stmt_file_insert || sqldb.prepare(`
        INSERT OR REPLACE INTO file_table (
        filePath, dirName, dirPath, fileName, mTime, size,
        isDisplayableInExplorer, isDisplayableInOnebook, 
        isCompress, isVideo, isFolder ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const isCompressFile = isCompress(fileName);
    const isVideoFile = isVideo(fileName);
    const isFolder = statObj.isDir;
    const isDisplayableInExplorer = util.isDisplayableInExplorer(fileName);
    const isDisplayableInOnebook = util.isDisplayableInOnebook(fileName);
    //set up tags
    const str = isDisplayableInExplorer ? path.basename(filePath, path.extname(filePath)) : getDirName(filePath);
    const temp = nameParser.parse(str) || {};

    const {
        authors=[],
        group="",
        comiket="",
        charNames=[],
        tags=[],
    } = temp;

    
    // tag插入sql
    let tags_rows = [];
    // comiket
    tags_rows.push([filePath, comiket, "tag", "comiket", isCompressFile, isFolder]);
    // name
    const nameTags = [...(namePicker.pick(str)||[]), ...charNames];
    nameTags.forEach(name => {
        tags_rows.push([filePath, name, "tag", "name", isCompressFile, isFolder]);
    })

    // parody
    tags.forEach(tt => {
        if (!authors.includes(tt) && group !== tt) {
            tags_rows.push([filePath, tt, "tag", "parody", isCompressFile, isFolder]);
        }
    })
    // author
    authors.forEach(tt => {
        tags_rows.push([filePath, tt, "author", "author", isCompressFile, isFolder]);
    })
    // group
    tags_rows.push([filePath, group, "group", "group", isCompressFile, isFolder]);

    // fliter null or empty
    tags_rows = tags_rows.filter(e => { return  e[1] && e[1].length > 0; })

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
    const dirName = getDirName(filePath);
    const fileSize = statObj.size || 0;
    // https://www.sqlitetutorial.net/sqlite-nodejs/insert/
    stmt_file_insert.run(filePath, dirName, dirPath, fileName, fileTimeA, fileSize,
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
    sqldb.run("DELETE FROM file_table where filePath = ?", filePath);
    sqldb.run("DELETE FROM tag_table where filePath = ?", filePath);
}

module.exports.getImgFolderInfo = (imgFolders) => {
    const imgFolderInfo = {};
    const imagefolderList = _.keys(imgFolders);

    let beg = getCurrentTime();
    let count = 0;
    // 每个文件夹
    for(let ii = 0; ii < imagefolderList.length; ii++){
        let folderPath = imagefolderList[ii];

        let files = imgFolders[folderPath];
        const len = files.length;
        let mtimeMs = 0, size = 0, totalImgSize = 0, 
            pageNum = 0, musicNum = 0, videoNum = 0;

        files = _.sortBy(files, e => e.mTime);
        // TODO 确定没有就没事的？ 避免前端又跑来问？
        let thumbnail = "NO_THUMBNAIL_AVAILABLE";

        //。。。的每个文件夹
        for (let jj = 0; jj < files.length; jj++){
            const file = files[jj];
            console.assert(file.isDisplayableInOnebook);
            console.assert("mTime" in file);
            console.assert("size" in file);

            count++;
            mtimeMs += file.mTime / len;
            size += file.size;
            const fp = file.filePath;
            if (isImage(fp)) {
                totalImgSize += file.size;
                pageNum++;
                thumbnail = fp;
            } else if (isMusic(fp)) {
                musicNum++;
            } else if(isVideo(fp)){
                videoNum++;
            }
        }

        // const _imgs = files.filter(isImage);
        // serverUtil.sortFileNames(_imgs);
        // const thumbnail = _imgs[0]

        imgFolderInfo[folderPath] = {
            mtimeMs,
            size,
            totalImgSize,
            pageNum,
            musicNum,
            videoNum,
            thumbnail
        };
    }

    let end = getCurrentTime();
    // console.log(`[getImgFolderInfo] ${count}images ${end - beg}ms`);
    return imgFolderInfo;
}
