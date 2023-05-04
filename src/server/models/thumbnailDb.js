const path = require('path');
const _ = require('underscore');
// const serverUtil = require("../serverUtil");
const userConfig = global.requireUserConfig();
const pathUtil = require("../pathUtil");
const util = global.requireUtil();
const { isCompress, isVideo, getCurrentTime } = util;

const { isSub, isExist } = pathUtil;
const rootPath = pathUtil.getRootPath();

let thumbnail_db_path = path.join(rootPath, userConfig.workspace_name, "thumbnail_sql_db.db");
const sqlite3 = require('sqlite3').verbose();
const sqlDb = new sqlite3.Database(thumbnail_db_path);

const _util = require('util');
sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);

module.exports.init = async ()=> {
    await sqlDb.runSync("CREATE TABLE IF NOT EXISTS thumbnail_table (filePath TEXT, thumbnailFileName TEXT);\
    CREATE INDEX IF NOT EXISTS filePath_index ON thumbnail_table (filePath)");
    await syncInternalDict()

    // comment out when needed
    // await clean();
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
async function syncInternalDict(){
    const sql = `SELECT * FROM  thumbnail_table`;
    let rows = await sqlDb.allSync(sql)

    rows.forEach(e => {
        _internal_dict_[e.filePath] = e;
    })
}

module.exports.updateThumbnail = async function (oldfilePath, newfilePath) {
    const sql2 = `UPDATE thumbnail_table SET filePath = ? WHERE filePath = ?`;
    await sqlDb.runSync(sql2, [newfilePath, oldfilePath])

    _internal_dict_[newfilePath] = _internal_dict_[oldfilePath]
}

module.exports.deleteThumbnail = function (filePath) {
    const sql2 = `DELETE FROM  thumbnail_table WHERE filePath = ?`;
    sqlDb.runSync(sql2, [filePath])
}

async function clean(){
    const sql = `SELECT * FROM  thumbnail_table ORDER BY filePath`;
    let rows = await sqlDb.allSync(sql)

    //if the real file is delete
    //remove from sql table
    // for(let ii = 0; ii < rows.length; ii++){
    //     const row = rows[ii];
    //     const filePath = row.filePath;
        
    //     if (!(await isExist(filePath))) {
    //         const sql2 = `DELETE FROM  thumbnail_table WHERE filePath = ?`;
    //         await sqlDb.runSync(sql2, [filePath])
    //         console.log(filePath)
    //     }
    //     console.log(ii)
    // }

    const pfs = require('promise-fs');
    const path = require("path")
    const thumbnailFolderPath = global.thumbnailFolderPath;
    let thumbnail_pathes = await pfs.readdir(thumbnailFolderPath);
    thumbnail_pathes = thumbnail_pathes.filter(util.isImage)

    // if the sql row is missing, delete the thumbnail file
    for(let ii = 0; ii < thumbnail_pathes.length; ii++){
        const fn = thumbnail_pathes[ii];
        const filePath = path.resolve(thumbnailFolderPath, fn)
        
        const record = rows.filter(row => row.thumbnailFileName == fn);

        if(record.length === 0){
            // console.log("need to remove ", filePath)
            const err = await pfs.unlink(filePath)
            if (err) { throw err; }
        }else{
            // console.log("need to keep ", filePath)
        }
        if (ii % 1000 === 0) {
            console.log(`[thumbnail] scan and clean unneeded thumbnails ${ii}`);
        }
    }
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

module.exports.getThumbnailForFolders = async function (filePathes) {
    console.assert(_.isArray(filePathes));

    if(filePathes.length == 0){
        return [];
    }

    let rows = [];
    try{
        // TODO 担心很多的时候
        // Q ask chatgpt: write a sql query that if column 'file' contains one of string array
        const stringsToMatch = filePathes; // string array of values
        const patterns = stringsToMatch.map(str => `${str}%`);
        const placeholders = patterns.map(() => 'filePath LIKE ?').join(' OR ');
        const sql = `SELECT * FROM thumbnail_table WHERE ${placeholders}`;
        rows = await sqlDb.allSync(sql, patterns);
    }catch(e){
        console.error(e);
    }

    
    // const sql = `SELECT * FROM  thumbnail_table WHERE INSTR(filePath, ?) > 0`;
    // let rows = await sqlDb.allSync(sql, [filePath]);
    // rows = rows.filter(row => {
    //     return isSub(filePath, row.filePath)
    // });
    _add_col(rows)
    return rows;
}

module.exports.getThumbCount = async function () {
    const sql = `SELECT COUNT(*) as count FROM  thumbnail_table`;
    const rows = await sqlDb.allSync(sql);
    return rows[0].count;
}
