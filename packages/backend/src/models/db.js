const _ = require('underscore');
const pathUtil = require("../utils/pathUtil");
const { getDirName } = pathUtil;
const path = require('path');
const serverUtil = require("../utils/serverUtil");
const util = require('../common/util');
const _util = require('util');
const { isImage, isCompress, isMusic, isVideo, getCurrentTime } = util;
const pfs = require('promise-fs');
const nameParser = require('../name-parser');
const namePicker = require("../human-name-picker");

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
const doSmartAllSync = module.exports.doSmartAllSync = async (sql, params) => {
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

module.exports.runSync  = async (sql, params) => {
    return await sqldb.runSync(sql, params);
}

let sqldb;
module.exports.init = async () => {
    const SQLWrapper = require("./SQLWrapper");
    const backup_db_path = path.join(pathUtil.getWorkSpacePath(), "shigureader_internal_db.sqlite");
    sqldb = new SQLWrapper(backup_db_path);

    console.log("remove previous db cache")

    await sqldb.execSync( `

        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF; 
        
        DROP TABLE IF EXISTS file_table;
        DROP TABLE IF EXISTS tag_file_table;
        DROP TABLE IF EXISTS tag_table;

        
    
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
            
        CREATE TABLE tag_file_table (
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


        CREATE TABLE tag_table (
            tag VARCHAR(50) NOT NULL COLLATE NOCASE,
            type VARCHAR(25) CHECK(type IN ('tag', 'author', 'group')),
            subtype VARCHAR(25)  CHECK(subtype IN ('comiket', 'name', 'parody', 'author', 'group')) ,

            good_count INTEGER,
            bad_count INTEGER,
            total_count INTEGER,

            score REAL,
            PRIMARY KEY (tag, type, subtype)
        );


        DROP TABLE IF EXISTS estimate_file_table;
        CREATE TABLE estimate_file_table (
            dirName TEXT,
            dirPath TEXT,
            fileName TEXT,
            scan_time INTEGER,
            isRemoved BOOL,
            PRIMARY KEY (dirPath, fileName)
        );


        DROP VIEW IF EXISTS author_view;
        DROP VIEW IF EXISTS tag_view;

        CREATE VIEW IF NOT EXISTS zip_view AS SELECT * FROM file_table WHERE isCompress;
    
        CREATE VIEW IF NOT EXISTS  author_view  AS SELECT * FROM tag_file_table WHERE type='author' AND (isCompress OR isFolder) ;
        CREATE VIEW IF NOT EXISTS  tag_view  AS SELECT * FROM tag_file_table WHERE type='tag' AND (isCompress OR isFolder);
    
        

         CREATE INDEX IF NOT EXISTS ft_fileName_index ON file_table (fileName);
         CREATE INDEX IF NOT EXISTS ft_dirPath_index ON file_table (dirPath);
         CREATE INDEX IF NOT EXISTS ft_dirName_index ON file_table (dirName);
         CREATE INDEX IF NOT EXISTS eft_fileName_index ON estimate_file_table (fileName);
         CREATE INDEX IF NOT EXISTS eft_dirName_index ON estimate_file_table (dirName);
      `);
    return sqldb;
}


module.exports.getAllFilePathes = async function (sql_condition) {
    const sql = `SELECT filePath FROM file_table ` + sql_condition;
    const temp = await sqldb.allSync(sql);
    return temp.map(e => e.filePath);
};

// ----- estimate file table helpers -----
module.exports.addEstimateFiles = async function(rows){
    if(!rows || rows.length === 0){
        return;
    }
    const time = getCurrentTime();
    rows = rows.map(r=>({ ...r, scan_time: time }));
    await sqldb.batchInsert("estimate_file_table", rows);
};

module.exports.markEstimateFilesRemoved = async function(dirPath, fileNames){
    if(!fileNames || fileNames.length === 0){
        return;
    }
    const placeholders = fileNames.map(()=>'?').join(',');
    const sql = `UPDATE estimate_file_table SET isRemoved=1, scan_time=? WHERE dirPath=? AND fileName IN (${placeholders})`;
    await sqldb.runSync(sql, [getCurrentTime(), dirPath, ...fileNames]);
};

module.exports.touchEstimateFiles = async function(dirPath, fileNames){
    if(!fileNames || fileNames.length === 0){
        return;
    }
    const placeholders = fileNames.map(()=>'?').join(',');
    const sql = `UPDATE estimate_file_table SET isRemoved=0, scan_time=? WHERE dirPath=? AND fileName IN (${placeholders})`;
    await sqldb.runSync(sql, [getCurrentTime(), dirPath, ...fileNames]);
};

module.exports.getEstimateFilesInDir = async function(dirPath){
    const sql = `SELECT * FROM estimate_file_table WHERE dirPath=?`;
    return await sqldb.allSync(sql, [dirPath]);
};

module.exports.findEstimateByText = async function(text){
    const sql = `SELECT fileName FROM estimate_file_table WHERE fileName LIKE ? AND isRemoved=0`;
    return await doSmartAllSync(sql, ["%" + text + "%"]);
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

    const common_tag_item = {
        filePath, 
        isCompress: isCompressFile, 
        isVideo: isVideoFile, 
        isMusic: isMusicFile,
        isImage: isImageFile,
        isFolder
    }

    if(comiket){
        // comiket
        tags_rows.push({ 
            tag:comiket, 
            type:"tag", 
            subtype:"comiket", 
            ...common_tag_item
        });
    }


    // TODO , ...charNames

    // name
    if(_.isEmpty(temp)){
        const nameTags = [...(namePicker.pick(str)||[])];
        _.uniq(nameTags).forEach(tag => {
            if (authors.includes(tag) || group === tag) {
                return;
            }
            tags_rows.push({ 
                tag, 
                type:"tag",
                subtype:"name", 
                ...common_tag_item});
        })
    }

    // parody
    _.uniq(tags).forEach(tag => {
        if (authors.includes(tag) || group === tag) {
            return;
        }
        tags_rows.push({ 
            tag, 
            type:"tag", 
            subtype:"parody", 
            ...common_tag_item });
    })
    // author
    _.uniq(authors).forEach(tag => {
        tags_rows.push({ 
            tag, 
            type:"author", 
            subtype:"author", 
            ...common_tag_item});
    })
    // group
    tags_rows.push({ 
        tag: group, 
        type:"group", 
        subtype:"group", 
        ...common_tag_item 
    });

    // fliter null or empty
    tags_rows = tags_rows.filter(e => { return e.filePath && e.tag && e.type && e.subtype; })

    if(insertion_cache){
        insertion_cache.tags.push(...tags_rows);
    }else{
        for(const row of tags_rows){
            sqldb.insertOneRow("tag_file_table", row);
        }
    }

    //file_table插入
    let fileTime = statObj.mtimeMs;
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
        throttledSyncTagTable();
    }
}

// 传入 db、table 和数据数组实现批量插入
const batchInsert = module.exports.batchInsert = async (tableName, dataArray, blockSize = 2000) => {
    let beg = getCurrentTime();

    await sqldb.batchInsert(tableName, dataArray, blockSize);

    let end = getCurrentTime();
    console.log(`[batchInsert] ${tableName} ${dataArray.length} ${end - beg}ms`);
}

module.exports.deleteFromDb = function (filePath) {
    // delete fileToInfo[filePath];
    sqldb.run("DELETE FROM file_table where filePath = ?", filePath);
    sqldb.run("DELETE FROM tag_file_table where filePath = ?", filePath);
    throttledSyncTagTable();
}




const scoreUtil = require('../utils/scoreUtil');  // Assuming scoreUtil is a module that contains the scoring logic.

async function sync_tag_table() {
    // Helper function to add scoring column.
    function _addCol(rows) {
        rows.forEach(row => {
            row.score = scoreUtil.getScoreFromCount(row);  // Adjust scoring function as necessary.
        });
    }

    try {
        // await sqldb.execSync( ` `);  truncate table
        // const sqlAuthor = `
        //     SELECT tag, type, MAX(subtype) AS subtype,
        //     COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
        //     COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
        //     COUNT(filePath) AS total_count
        //     FROM author_view
        //     GROUP BY tag, type`;
        // let authorInfo = await doSmartAllSync(sqlAuthor, [global.good_folder_root, global.not_good_folder_root]);
        // _addCol(authorInfo);  // Add score column to each row.

        // const sqlTag = `
        //     SELECT tag, MAX(subtype) AS subtype,
        //     COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
        //     COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
        //     COUNT(filePath) AS total_count
        //     FROM tag_view
        //     GROUP BY tag, type `;
        // let tagInfo = await doSmartAllSync(sqlTag, [global.good_folder_root, global.not_good_folder_root]);
        // _addCol(tagInfo);  // Add score column to each row.

        // const combinedData = [...authorInfo, ...tagInfo];

        const placeholder = "-----||------";

        const sqlTag = `
            SELECT tag, type, subtype,
            COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
            COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
            COUNT(filePath) AS total_count
            FROM 
                (SELECT * FROM tag_file_table WHERE isCompress OR isFolder )
            GROUP BY tag, type, subtype `;
        let tagInfo = await doSmartAllSync(sqlTag, [global.good_folder_root || placeholder, global.not_good_folder_root || placeholder ]);
        _addCol(tagInfo);  // Add score column to each row.


        await batchInsert('tag_table', tagInfo);
    } catch (error) {
        console.error('Failed to sync tag table:', error);
    }
}

const throttledSyncTagTable = _.debounce(sync_tag_table, 5000);
module.exports.throttledSyncTagTable = throttledSyncTagTable;



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

        // files = _.sortBy(files, e => e.mTime);
        // util.sortFileNames(files)
        // TODO 确定没有就没事的？ 避免前端又跑来问？

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
            } else if (file.isMusic) {
                musicNum++;
            } else if(file.isVideo){
                videoNum++;
            }
        }

        const thumbnail = serverUtil.chooseThumbnailImage(files.map(e => e.filePath)) || "NO_THUMBNAIL_AVAILABLE";

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
