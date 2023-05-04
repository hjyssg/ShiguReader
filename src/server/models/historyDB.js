// const _ = require('underscore');
const path = require('path');
const util = global.requireUtil();
const { getCurrentTime } = util;

const pathUtil = require("../pathUtil");
// const serverUtil = require("../serverUtil");

const userConfig = global.requireUserConfig();
const rootPath = pathUtil.getRootPath();
const history_db_path = path.join(rootPath, userConfig.workspace_name, "history_sql_db.db");
const sqlite3 = require('sqlite3').verbose();
const sqlDb = new sqlite3.Database(history_db_path);

const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);

module.exports.init = async ()=> {
    // 记录打开文件
    let sql = `CREATE TABLE IF NOT EXISTS history_table (filePath TEXT NOT NULL, dirPath TEXT, fileName TEXT, time INTEGER); 
                 CREATE INDEX IF NOT EXISTS fileName_index ON history_table (fileName);
                 CREATE INDEX IF NOT EXISTS time_index ON history_table (time);
                 `
    await sqlDb.runSync(sql);

    // 记录文件夹lsdir的table
    sql = `CREATE TABLE IF NOT EXISTS lsdir_history_table (filePath TEXT NOT NULL, time INTEGER); 
    CREATE INDEX IF NOT EXISTS filePath_lsdir_index ON lsdir_history_table (fileName);
    CREATE INDEX IF NOT EXISTS time_lsdir_index ON lsdir_history_table (time);
    `
    await sqlDb.runSync(sql);
}

module.exports.getSQLDB = function () {
    return sqlDb;
}

module.exports.addOneRecord = function (filePath) {
    const time = util.getCurrentTime()
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);

    // sql = "INSERT OR REPLACE INTO history_table(filePath, dirPath, fileName, time ) values(?, ?, ?, ?)";
    sql = "INSERT INTO history_table(filePath, dirPath, fileName, time ) values(?, ?, ?, ?)";
    sqlDb.run(sql, filePath, dirPath, fileName, time);
}

module.exports.addOneLsDirRecord = function (filePath) {
    const time = util.getCurrentTime()
    sql = "INSERT INTO lsdir_history_table(filePath, time ) values(?, ?)";
    sqlDb.run(sql, filePath, time);
}

// const back_days = 5;
const PAGE_TIME_SIZE = 200;
module.exports.getHistory = async function (page=0) {
    // let time = util.getCurrentTime();
    // time = time - 1000 * 3600 * 24 * back_days;
    // const sql = `SELECT  filePath, MAX(time) as time FROM 
    //             (SELECT * FROM history_table where time > ?) 
    //          GROUP BY filePath`
    // const sql = `SELECT * FROM history_table where time > ?`
    // const sql = `SELECT * FROM history_table ORDER BY time DESC LIMIT ${page*200}, ${(page+1)*200}`

    // https://www.tutorialspoint.com/sqlite/sqlite_limit_clause.htm
    const sql = `
    SELECT filePath, dirPath, fileName, MAX(time) as time FROM 
        (SELECT * FROM history_table ORDER BY time DESC  LIMIT ${PAGE_TIME_SIZE} OFFSET ${page*PAGE_TIME_SIZE})  
    GROUP BY filePath 
    ORDER BY time DESC 
    ;`
    let rows = await sqlDb.allSync(sql);
    console.assert(rows.length < PAGE_TIME_SIZE)
    // return rows;

    const sql2 = `SELECT count(*) as count FROM history_table`
    let counts = await sqlDb.allSync(sql2);
    return {rows, count: counts[0]["count"]}
}

// SELECT *, strftime('%d-%m-%Y', datetime(time/1000, 'unixepoch')) FROM history_table ORDER BY time DESC
module.exports.getHistoryByFP = async function (fileName) {
    // 一天算一次
    // let rows1 = await sqlDb.allSync("SELECT filePath, time FROM history_table WHERE fileName = ?", [fileName]);
    // const sql = `SELECT filePath, Max(time) as time FROM
    //              (SELECT * FROM history_table where time > ?)  
    //             GROUP BY strftime('%d-%m-%Y', datetime(time/1000, 'unixepoch')) ORDER BY time DESC`

    const sql = `SELECT filePath, Max(time) as time FROM
     (SELECT * FROM history_table where fileName = ?)  
     GROUP BY strftime('%d-%m-%Y', datetime(time/1000, 'unixepoch')) ORDER BY time DESC`
    let rows = await sqlDb.allSync(sql, [fileName]);
    return rows;
}


const quick_access_day = 10;
module.exports.getQuickAccess = async function () {
    let time = util.getCurrentTime();
    time = time - 1000 * 3600 * 24 * quick_access_day;
    const sql = `
        SELECT filePath, count(filePath) AS count 
        FROM lsdir_history_table 
        WHERE time > ? 
        GROUP BY filePath 
        ORDER BY count DESC, filePath ASC
        LIMIT 50;
    `
    let rows = await sqlDb.allSync(sql, [time]);
    return rows;
}

module.exports.getFileHistory = async function (pathes) {
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
    const placeholders = fileNames.map(() => '?').join(',');
    const sql = `SELECT fileName, MAX(time) as time, COUNT(time) as count FROM 
    history_table where fileName IN (${placeholders})  
    GROUP BY fileName`
    let rows =  await sqlDb.allSync(sql, fileNames);

    // let end3 = getCurrentTime();
    // console.log(`[getFileHistory] ${(end3 - end1) / 1000}s for ${fileNames.length} zips`);

    return rows;
}
