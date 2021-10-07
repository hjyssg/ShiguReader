const path = require('path');
const _ = require('underscore');
// const serverUtil = require("../serverUtil");
const userConfig = global.requireUserConfig();
const pathUtil = require("../pathUtil");
const util = global.requireUtil();
const { isCompress, isVideo, getCurrentTime } = util;

const {
    isSub
} = pathUtil;
const rootPath = pathUtil.getRootPath();

let thumbnail_db_path = path.join(rootPath, userConfig.workspace_name, "thumbnail_sql_db");
const sqlite3 = require('sqlite3').verbose();
const sqlDb = new sqlite3.Database(thumbnail_db_path);

const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);

module.exports.init = async ()=> {
    await sqlDb.runSync("CREATE TABLE IF NOT EXISTS thumbnail_table (filePath TEXT, thumbnailFileName TEXT);\
    CREATE INDEX IF NOT EXISTS filePath_index ON thumbnail_table (filePath)");
    await syncInterbalDict()

     //todo iterate all thumbnail 
    //if the real file is delete
    //remove sql table

    //todo2: if the thumgbnail is deleted, but sql still keep the record
}

module.exports.addNewThumbnail = function (filePath, thumbnailFilePath) {
    const thumbnailFileName = path.basename(thumbnailFilePath);
    sqlDb.run("INSERT OR REPLACE INTO thumbnail_table(filePath, thumbnailFileName ) values(?, ?)", filePath, thumbnailFileName);
    _internal_dict_[filePath] = {filePath, thumbnailFileName}
}

function _add_col(rows) {
    const thumbnailFolderPath = global.thumbnailFolderPath;
    rows.forEach(row => {
        // row.thumbnailFilePath = path.resolve(thumbnailFolderPath, row.thumbnailFileName)
        row.thumbnailFilePath = thumbnailFolderPath + path.sep + row.thumbnailFileName;
    })
    return rows;
}

const _internal_dict_ = {};
async function syncInterbalDict(){
    const sql = `SELECT * FROM  thumbnail_table`;
    let rows = await sqlDb.allSync(sql)

    rows.forEach(e => {
        _internal_dict_[e.filePath] = e;
    })
}


//multiple
module.exports.getThumbnailArr = function (filePathes) {
    filePathes = _.isString(filePathes) ? [filePathes] : filePathes;
    filePathes = filePathes.filter(isCompress);

    // const joinStr = filePathes.join(" ");
    //todo: slow for large number
    // const sql = `SELECT * FROM  thumbnail_table WHERE INSTR(?, filePath) > 0`;
    // let rows = await sqlDb.allSync(sql, [joinStr]);

    // const promiseArr = filePathes.map(fp => {
    //     const sql = `SELECT * FROM  thumbnail_table WHERE filePath = ?`;
    //     return sqlDb.getSync(sql, [fp]);
    // })

    // let rows =  await Promise.all(promiseArr);
    // rows = rows.filter(e => !!e);

    let rows = filePathes.map(e => _internal_dict_[e]);
    rows = rows.filter(e => !!e);
    rows = _add_col(rows);
    return rows;
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
