// const _ = require('underscore');
const path = require('path');
const util = require('../common/util');
// const { getCurrentTime } = util;
const pathUtil = require("../utils/path-util");
const appState = require('../state/appState');


let sqldb;
module.exports.init = async (_sqldb)=> {
    sqldb = _sqldb;
    await sqldb.execSync(`CREATE TABLE IF NOT EXISTS history_table (
        filePath TEXT NOT NULL, 
        dirPath TEXT, 
        fileName TEXT, 
        time INTEGER
    ); 
    CREATE INDEX IF NOT EXISTS fileName_index ON history_table (fileName);
    CREATE INDEX IF NOT EXISTS time_index ON history_table (time); 
     
     
    CREATE TABLE IF NOT EXISTS lsdir_history_table (
        filePath TEXT NOT NULL, 
        time INTEGER
    ); 
    CREATE INDEX IF NOT EXISTS filePath_lsdir_index ON lsdir_history_table (filePath);
    CREATE INDEX IF NOT EXISTS time_lsdir_index ON lsdir_history_table (time);
    
    `);
}

// cache内部的不记录
function noNeedRecord(filePath){
    const cachePath = appState.getCachePath();
    return cachePath && pathUtil.isSub(cachePath, filePath);
}

async function getLatestRecordForFilePath(filePath) {
    if (!filePath) {
        return null;
    }

    const sql = `SELECT time FROM history_table WHERE filePath = ? ORDER BY time DESC LIMIT 1`;
    return await sqldb.getSync(sql, [filePath]);
}

module.exports.getLatestRecordForFilePath = getLatestRecordForFilePath;

module.exports.addOneRecord = async function (filePath, recordTime) {
    if(noNeedRecord(filePath)){
        return false;
    }

    const time = typeof recordTime === 'number' ? recordTime : util.getCurrentTime();
    const lastRecord = await getLatestRecordForFilePath(filePath);
    const lastTime = lastRecord && typeof lastRecord.time === 'number' ? lastRecord.time : null;
    const FIVE_MINUTES = 5 * 60 * 1000;

    if (lastTime && time - lastTime < FIVE_MINUTES) {
        return false;
    }

    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);

    await sqldb.insertOneRow("history_table", {
        filePath, dirPath, fileName, time
    });
    return true;
}

module.exports.addOneLsDirRecord = function (filePath) {
    if(noNeedRecord(filePath)){
        return;
    }
    const time = util.getCurrentTime()
    sqldb.insertOneRow("lsdir_history_table", {
        filePath, time
    });
}

// const back_days = 5;
const PAGE_TIME_SIZE = 200;
module.exports.getHistoryPageData = async function (page=0) {
    // https://www.tutorialspoint.com/sqlite/sqlite_limit_clause.htm
    const sql = `
    SELECT filePath, dirPath, fileName, MAX(time) as time FROM 
        (SELECT * FROM history_table ORDER BY time DESC  LIMIT ${PAGE_TIME_SIZE} OFFSET ${page*PAGE_TIME_SIZE})  
    GROUP BY filePath 
    ORDER BY time DESC ;`
    let rows = await sqldb.allSync(sql);
    console.assert(rows.length <= PAGE_TIME_SIZE)
    // return rows;

    const sql2 = `SELECT count(*) as count FROM history_table;`
    let counts = await sqldb.allSync(sql2);
    return {rows, count: counts[0]["count"]}
}

/** 单个文件的全部历史记录  */
module.exports.getHistoryForOneFile = async function (fileName) {
    const sql = `SELECT * FROM history_table where fileName = ? ORDER BY time DESC`
    let rows = await sqldb.allSync(sql, [fileName]);
    return rows;
}


module.exports.getRecentAccess = async function () {
    let time = util.getCurrentTime();
    // const recent_access_day = 31; // day
    // time = time - 1000 * 3600 * 24 * recent_access_day;
    // const sql = `
    //     SELECT filePath, count(filePath) AS count 
    //     FROM lsdir_history_table 
    //     WHERE time > ? 
    //     GROUP BY filePath 
    //     HAVING count > 3
    //     ORDER BY count DESC, filePath ASC
    //     LIMIT 30;
    // `

    // GPT好牛啊。。。
    // 计算方式是对于过去30天，每次访问的权重值叠加起来。
    // 权重值是根据每次访问时间的新旧决定。
    // 取前20个。
    const sql = `
    WITH WeightedVisits AS (
        SELECT
            filePath,
            (1 / (julianday('now') - julianday(time/1000, 'unixepoch') + 1)) AS weight -- 计算权重
        FROM
            lsdir_history_table
        WHERE
            time >= strftime('%s', 'now', '-30 day') -- 过去30天内的数据
    )
    
    SELECT
        filePath,
        SUM(weight) AS total_weight
    FROM
        WeightedVisits
    GROUP BY
        filePath
    ORDER BY
        total_weight DESC
    LIMIT
        20;
    `
    let rows = await sqldb.allSync(sql);
    return rows;
}

/** n个文件的最新一次记录 */
const _getFileHistory = async function (pathes) {
    pathes = pathes || [];
    const fileNames = pathes.map(e => {
        return path.basename(e);
    });

    if(fileNames.length == 0){
        return [];
    }

    console.assert(pathes.length < 20000, "may Too many SQL variables");
    // chatgpt Q1: how to sql query select with an huge array 
    // chatgpt Q2: does sqlite have query text limit
    // 240501 想明白了，其实最好的方式是额外再维护一个file_count_table和file_recent_access_table，但吃饱撑。
    const placeholders = fileNames.map(() => '?').join(',');
    const sql = `SELECT fileName, MAX(time) as time, COUNT(time) as count FROM 
    history_table where fileName IN (${placeholders})  
    GROUP BY fileName`
    let rows =  await sqldb.allSync(sql, fileNames);

    return rows;
}


module.exports.getBatchFileHistory = async (all_pathes) => {
    //需要拆分成好几个小array
    const fileHistory = [];
    const subs = util.cutIntoSmallArrays(all_pathes);
    for(const sub of subs){
        const temp = await _getFileHistory(sub);
        fileHistory.push(...temp);
    }

    // assert
    const subLength = subs.map(e => e.length).reduce(function(a, b) { return a + b; }, 0);
    console.assert(subLength === all_pathes.length);
    
    return fileHistory;
}