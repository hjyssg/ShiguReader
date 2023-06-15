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
// const fileToInfo = {};
// const getFileToInfo = function (filePath) {
//     return fileToInfo[filePath];
// }

// let stmd_single_file;
// const getFileToInfoAsync = async (filePath) => {
//     // const sql = ;
//     // return await sqldb.getSync(sql, [filePath]);
//     if(!stmd_single_file){
//         stmd_single_file =  sqldb.prepare(` SELECT * FROM file_table WHERE filePath = ?`)
//         stmd_single_file.getSync = _util.promisify(stmd_single_file.get).bind(stmd_single_file);
//     }
//     return stmd_single_file.getSync(filePath)
// }

let statement_cache = {};
module.exports.doSmartAllSync = async (sql, params) => {
    if(!_.isNull(params) && !_.isArray(params)){
        params = [params];
    }
    if(_.isArray(params)){
        console.assert(params.length < 20);
    }  

    // 可能是sql文都比较简单，性能提升大约只有百分之三。
    if(!statement_cache[sql]){
        const statement = sqldb.prepare(sql);
        statement.allSync = _util.promisify(statement.all).bind(statement);
        statement_cache[sql] = statement;
    }
    
    const result = await statement_cache[sql].allSync(params); 
    return result || [];
}

module.exports.doAllSync  = async (sql, params) => {
    return await sqldb.allSync(sql, params);
}

let sqldb;
module.exports.init = async ()=> {
    const dbCommon = require("./dbCommon");
    const backup_db_path = path.join(pathUtil.getWorkSpacePath(), "shigureader_internal_db.sqlite");
    sqldb = dbCommon.getSQLInstance(backup_db_path);

    // 提升少量性能
    await sqldb.execSync( `

    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF; 
    
    DROP TABLE IF EXISTS file_table;
    DROP TABLE IF EXISTS tag_table;
    DROP TABLE IF EXISTS scan_path_table;

    CREATE TABLE file_table (
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
                            isMusic BOOL,
                            isImage BOOL,
                            isFolder BOOL);

    CREATE TABLE tag_table (
                            filePath TEXT NOT NULL, 
                            tag VARCHAR(50) NOT NULL COLLATE NOCASE, 
                            type VARCHAR(25) CHECK(type IN ('tag', 'author', 'group')),
                            subtype VARCHAR(25)  CHECK(subtype IN ('comiket', 'name', 'parody', 'author', 'group')) , 
                            isCompress BOOL,
                            isVideo BOOL,
                            isMusic BOOL,
                            isImage BOOL,
                            isFolder BOOL,
                            PRIMARY KEY (filePath, tag, type, subtype) 
                        );

    CREATE TABLE scan_path_table (filePath TEXT NOT NULL, type VARCHAR(25));

    CREATE VIEW IF NOT EXISTS zip_view AS SELECT * FROM file_table WHERE isCompress = true;

    CREATE VIEW IF NOT EXISTS  author_view  AS SELECT * FROM tag_table WHERE type='author' AND (isCompress = true OR isFolder = true) ;
    CREATE VIEW IF NOT EXISTS  tag_view  AS SELECT * FROM tag_table WHERE type='tag' AND (isCompress = true OR isFolder = true);


     CREATE INDEX IF NOT EXISTS ft_filePath_index ON file_table (filePath); 
     CREATE INDEX IF NOT EXISTS ft_fileName_index ON file_table (fileName); 
     CREATE INDEX IF NOT EXISTS ft_dirPath_index ON file_table (dirPath); 
     CREATE INDEX IF NOT EXISTS ft_dirName_index ON file_table (dirName); 

     CREATE INDEX IF NOT EXISTS tag_index ON tag_table (tag); 
     CREATE INDEX IF NOT EXISTS tag_type_index ON tag_table (type); 
     CREATE INDEX IF NOT EXISTS tag_filePath_index ON tag_table (filePath); `);

     return sqldb;
}


// module.exports.insertScanPath = async function(scan_path){
//     const stmt = sqldb.prepare('INSERT INTO scan_path_table(filePath, type) VALUES (?, ?)');
//     for(let pp of scan_path){
//         stmt.run(pp, "");
//     }
// }

// module.exports.getAllScanPath = async function(){
//     const sql = `SELECT filePath FROM scan_path_table `;
//     const temp = await sqldb.allSync(sql);
//     return temp.map(e => e.filePath);
// }

module.exports.getAllFilePathes = async function (sql_condition) {
    const sql = `SELECT filePath FROM file_table ` + sql_condition;
    const temp = await sqldb.allSync(sql);
    return temp.map(e => e.filePath);
};

module.exports.updateStatToDb = async function (filePath, stat, insertion_cache) {

    const statObj = {};
    if (!stat) {
        //seems only happen on mac
        stat = await pfs.stat(filePath)
    }

    statObj.isDir = stat.isDirectory();
    statObj.mtimeMs = stat.mtimeMs;
    statObj.size = Number(stat.size);
    // fileToInfo[filePath] = statObj;
    
    
    console.assert(!!filePath);
    console.assert(statObj);
    const fileName = path.basename(filePath);

    const isCompressFile = isCompress(fileName);
    const isVideoFile = isVideo(fileName);
    const isMusicFile = isMusic(fileName);
    const isImageFile = isImage(fileName);
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
    tags_rows.push({ 
        filePath, 
        tag:comiket, 
        type:"tag", 
        subtype:"comiket", 
        isCompress: isCompressFile, 
        isVideo: isVideoFile, 
        isMusic: isMusicFile,
        isImage: isImageFile,
        isFolder
    });

    // name
    const nameTags = [...(namePicker.pick(str)||[]), ...charNames];
    _.uniq(nameTags).forEach(tag => {
        tags_rows.push({ 
            filePath, 
            tag, 
            type:"tag",
            subtype:"name", 
            isCompress: isCompressFile, 
            isVideo: isVideoFile, 
            isMusic: isMusicFile,
            isImage: isImageFile,
            isFolder});
    })

    // parody
    _.uniq(tags).forEach(tag => {
        if (authors.includes(tag) || group === tag) {
            return;
        }
        tags_rows.push({ 
            filePath, 
            tag, 
            type:"tag", 
            subtype:"parody", 
            isCompress: isCompressFile, 
            isVideo: isVideoFile, 
            isMusic: isMusicFile,
            isImage: isImageFile,
            isFolder });
    })
    // author
    _.uniq(authors).forEach(tag => {
        tags_rows.push({ 
            filePath, 
            tag, 
            type:"author", 
            subtype:"author", 
            isCompress: isCompressFile, 
            isVideo: isVideoFile, 
            isMusic: isMusicFile,
            isImage: isImageFile,
            isFolder });
    })
    // group
    tags_rows.push({ 
        filePath, 
        tag: group, 
        type:"group", 
        subtype:"group", 
        isCompress: isCompressFile, 
        isVideo: isVideoFile, 
        isMusic: isMusicFile,
        isImage: isImageFile,
        isFolder });

    // fliter null or empty
    tags_rows = tags_rows.filter(e => { return e.filePath && e.tag && e.type && e.subtype; })

    if(insertion_cache){
        insertion_cache.tags.push(...tags_rows);
    }else{
        for(const row of tags_rows){
            sqldb.insertOneRow("tag_table", row);
        }
    }

    //file_table插入
    let aboutTimeA = nameParser.getDateFromParse(str);
    aboutTimeA = aboutTimeA && aboutTimeA.getTime();
    let fileTime = statObj.mtimeMs || aboutTimeA;
    const dirPath = path.dirname(filePath);
    const dirName = getDirName(filePath);
    const fileSize = statObj.size || 0;
    const params = {
        filePath, 
        dirName, 
        dirPath, 
        fileName, 
        mTime: fileTime, 
        size: fileSize,
        isDisplayableInExplorer, 
        isDisplayableInOnebook, 
        isCompress: isCompressFile, 
        isVideo: isVideoFile, 
        isMusic: isMusicFile,
        isImage: isImageFile,
        isFolder }

    if(insertion_cache){
        insertion_cache.files.push(params);
    }else{
        sqldb.insertOneRow("file_table", params);
    }
}

// 传入 db、table 和数据数组实现批量插入
module.exports.batchInsert = async (tableName, dataArray, blockSize = 2000) => {

    let beg = getCurrentTime();

    await sqldb.batchInsert(tableName, dataArray, blockSize);

    let end = getCurrentTime();
    console.log(`[batchInsert] ${tableName} ${dataArray.length} ${end - beg}ms`);
    
}

module.exports.deleteFromDb = function (filePath) {

    // delete fileToInfo[filePath];
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
            console.assert("isImage" in file);

            count++;
            mtimeMs += file.mTime / len;
            size += file.size;
            const fp = file.filePath;
            if (file.isImage) {
                totalImgSize += file.size;
                pageNum++;
                thumbnail = fp;
            } else if (file.isMusic) {
                musicNum++;
            } else if(file.isVideo){
                videoNum++;
            }
        }

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
