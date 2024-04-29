const path = require('path');
const _ = require('underscore');
const serverUtil = require("../serverUtil");
// const userConfig = global.requireUserConfig();
// const pathUtil = require("../pathUtil");
const util = global.requireUtil();
// const _util = require('util');


let sqldb;
module.exports.init = async (_sqldb)=> {
    sqldb = _sqldb;
    // TODO make filepath unique
    await sqldb.execSync(`
        CREATE TABLE IF NOT EXISTS thumbnail_table (filePath TEXT PRIMARY KEY, thumbnailFileName TEXT, time INTEGER);
        
        CREATE INDEX IF NOT EXISTS filePath_index ON thumbnail_table (filePath);
    `);
    await syncInternalDict()
}

module.exports.addNewThumbnail = function (filePath, thumbnailFilePath) {
    const thumbnailFileName = path.basename(thumbnailFilePath);
    const time = util.getCurrentTime()
    sqldb.insertOneRow("thumbnail_table", {
        filePath, thumbnailFileName, time
    });
    _internal_dict_[filePath] = {filePath, thumbnailFileName,time}
}

function _add_col(rows) {
    rows.forEach(row => {
        // row.thumbnailFilePath = path.resolve(thumbnailFolderPath, row.thumbnailFileName)
        row.thumbnailFilePath = serverUtil.joinThumbnailFolderPath(row.thumbnailFileName);
    })
    return rows;
}

const _internal_dict_ = {};
async function syncInternalDict(){
    const sql = `SELECT * FROM  thumbnail_table`;
    let rows = await sqldb.allSync(sql)

    rows.forEach(e => {
        _internal_dict_[e.filePath] = e;
    })
}

module.exports.deleteThumbnail = function (filePath) {
    const sql2 = `DELETE FROM  thumbnail_table WHERE filePath = ?`;
    sqldb.runSync(sql2, [filePath]);
    //不删除文件，避免部分的bug
    //文件占的空间很小，无所谓
}

// async function clean(){
//     // 额外写一个python维护脚本来清理更简单。
// }


//multiple
module.exports.getThumbnailArr = function (filePathes) {
    filePathes = _.isString(filePathes) ? [filePathes] : filePathes;

    // 大量的时候，唯一快速查找的方法就是最简单的hashmap。sql怎么都不行。
    // const joinStr = filePathes.join(" ");
    //  slow for large number
    // const sql = `SELECT * FROM  thumbnail_table WHERE INSTR(?, filePath) > 0`;
    // let rows = await sqldb.allSync(sql, [joinStr]);
    // 
    // const promiseArr = filePathes.map(fp => {
    //     const sql = `SELECT * FROM  thumbnail_table WHERE filePath = ?`;
    //     return sqldb.getSync(sql, [fp]);
    // })
    // let rows =  await Promise.all(promiseArr);
    // rows = rows.filter(e => !!e);

    let rows = filePathes.map(e => _internal_dict_[e]);
    rows = rows.filter(e => !!e);
    rows = _add_col(rows);
    return rows;
}


module.exports.getThumbnailByFileName = async function (fileName) {
    const sql = `SELECT * FROM thumbnail_table WHERE filePath LIKE ?`;
    let rows = await sqldb.allSync(sql, [`%${fileName}`]);
    rows = _add_col(rows);
    return rows;
}


module.exports.getThumbCount = async function () {
    const sql = `SELECT COUNT(*) as count FROM  thumbnail_table`;
    const rows = await sqldb.allSync(sql);
    return rows[0].count;
}
