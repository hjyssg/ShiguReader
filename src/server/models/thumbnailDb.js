const path = require('path');
const _ = require('underscore');
// const serverUtil = require("../serverUtil");
const userConfig = global.requireUserConfig();
const pathUtil = require("../pathUtil");
const util = global.requireUtil();
const { isCompress, isVideo } = util;

const {
    isSub
} = pathUtil;
const rootPath = pathUtil.getRootPath();

let thumbnail_db_path = path.join(rootPath, userConfig.workspace_name, "thumbnail_sql_db");
const sqlite3 = require('sqlite3').verbose();
const sqlDb = new sqlite3.Database(thumbnail_db_path);
sqlDb.run("CREATE TABLE IF NOT EXISTS thumbnail_table (filePath TEXT, thumbnailFileName TEXT);");
sqlDb.run("CREATE INDEX IF NOT EXISTS filePath_index ON thumbnail_table (filePath)");

const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);

module.exports.addNewThumbnail = function (filePath, thumbnailFilePath) {
    const thumbnailFileName = path.basename(thumbnailFilePath);
    sqlDb.run("INSERT OR REPLACE INTO thumbnail_table(filePath, thumbnailFileName ) values(?, ?)", filePath, thumbnailFileName);
}

module.exports.init = function (filePathes) {
    //todo iterate all thumbnail 
    //if the real file is delete
    //remove sql table

    //todo2: if the thumgbnail is deleted, but sql still keep the record

}


function _add_col(rows) {
    const thumbnailFolderPath = global.thumbnailFolderPath;
    rows.forEach(row => {
        row.thumbnailFilePath = path.resolve(thumbnailFolderPath, row.thumbnailFileName)
    })
    return rows;
}

//multiple
module.exports.getThumbnailArr = async function (filePathes) {
    filePathes = _.isString(filePathes) ? [filePathes] : filePathes;
    filePathes = filePathes.filter(isCompress);
    // const joinStr = filePathes.join(" ");
    //todo: slow for large number
    // const sql = `SELECT * FROM  thumbnail_table WHERE INSTR(?, filePath) > 0`;
    // let rows = await sqlDb.allSync(sql, [joinStr]);

    const promiseArr = filePathes.map(fp => {
        const sql = `SELECT * FROM  thumbnail_table WHERE filePath = ?`;
        return sqlDb.getSync(sql, [fp]);
    })

    let rows =  await Promise.all(promiseArr);
    rows = rows.filter(e => !!e);
    return _add_col(rows);
}

module.exports.getThumbnailForFolder = async function (filePath) {
    const sql = `SELECT * FROM  thumbnail_table WHERE INSTR(filePath, ?) > 0`;
    let rows = await sqlDb.allSync(sql, [filePath]);
    rows = rows.filter(row => {
        return isSub(filePath, row.filePath)
    });
    _add_col(rows)
    return rows;
}

module.exports.getThumbCount = async function () {
    const sql = `SELECT COUNT(*) as count FROM  thumbnail_table`;
    const rows = await sqlDb.allSync(sql);
    return rows[0].count;
}
