// const _ = require('underscore');
const path = require('path');
const util = global.requireUtil();
const pathUtil = require("../pathUtil");
// const serverUtil = require("../serverUtil");

const userConfig = global.requireUserConfig();
const rootPath = pathUtil.getRootPath();
const history_db_path = path.join(rootPath, userConfig.workspace_name, "history_sql_db");
const sqlite3 = require('sqlite3').verbose();
const sqlDb = new sqlite3.Database(history_db_path);
sqlDb.run("CREATE TABLE IF NOT EXISTS history_table (filePath TEXT NOT NULL, dirPath TEXT, fileName TEXT, time INTEGER); CREATE INDEX IF NOT EXISTS fileName_index ON history_table (fileName)");


const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);

module.exports.getSQLDB = function () {
    return sqlDb;
}

module.exports.addOneRecord = function (filePath) {
    const time = util.getCurrentTime()
    const fileName = path.basename(filePath);
    const dirPath = path.dirname(filePath);

    sqlDb.run("INSERT OR REPLACE INTO history_table(filePath, dirPath, fileName, time ) values(?, ?, ?, ?)",
        filePath, dirPath, fileName, time);
}

const back_days = 5;
module.exports.getHistory = async function () {
    let time = util.getCurrentTime();
    time = time - 1000 * 3600 * 24 * back_days;
    let rows = await sqlDb.allSync("SELECT filePath, MAX(time) as time FROM history_table where time > ? GROUP BY filePath", [time]);
    return rows;
}

const quick_access_day = 10;
module.exports.getQuickAccess = async function () {
    let time = util.getCurrentTime();
    time = time - 1000 * 3600 * 24 * quick_access_day;
    let rows = await sqlDb.allSync("SELECT dirPath, count(dirPath) AS count FROM history_table where time > ? GROUP BY dirPath ORDER BY count DESC", [time]);
    return rows;
}

module.exports.getFileReadTime = async function (pathes) {
    pathes = pathes || [];
    const fileNames = pathes.map(e => {
        return path.basename(e);
    });

    // const joinStr = fileNames.join(" ");
    // let sql = "SELECT fileName, MAX(time) as time FROM history_table where INSTR(?, fileName) > 0 GROUP BY fileName"
    // let rows = await sqlDb.allSync(sql, [joinStr]);

    const promiseArr = fileNames.map(fp => {
        const sql = "SELECT fileName, MAX(time) as time FROM history_table where fileName = ? GROUP BY fileName"
        return sqlDb.getSync(sql, [fp]);
    })
    let rows =  await Promise.all(promiseArr);
    rows = rows.filter(e => !!e);

    const fileNameToReadTime = {};
    rows.forEach(row => {
        const { fileName, time } = row;
        fileNameToReadTime[fileName] = time;
    })

    return fileNameToReadTime;
}
