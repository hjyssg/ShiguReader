const util = global.requireUtil();
const { isImage, isMusic, isCompress, isVideo } = util;
const _ = require('underscore');

// const userConfig = global.requireUserConfig();
const path = require('path');
const pathUtil = require("../pathUtil");


let sqldb;
//-----------------------
module.exports.init = async ()=> {
    let zip_sql_path = path.join(pathUtil.getWorkSpacePath(), "zip_info_sql.db");
    const dbCommon = require("./dbCommon");
    sqldb = dbCommon.getSQLInstance(zip_sql_path);

    await sqldb.runSync(`CREATE TABLE IF NOT EXISTS zip_table (
                            filePath TEXT PRIMARY KEY, 
                            pageNum INTEGER,
                            musicNum INTEGER,
                            videoNum INTEGER,
                            totalNum INTEGER,
                            totalImgSize INTEGER,
                            mtime INTEGER );
                        `);
    await syncInternalDict()
}

module.exports.has = function (filePath) {
    const data = getZipInfo(filePath);
    return data.length > 0;
}

const updateZipDb = module.exports.updateZipDb = function (info) {
    const {   
        filePath,
        totalImgSize,
        files,
        mtime} = info;

    const pageNum = files.filter(isImage).length;
    const musicNum = files.filter(isMusic).length;
    const videoNum = files.filter(isVideo).length;
    const totalNum = files.length;

    sqldb.run(`INSERT OR REPLACE INTO zip_table (
            filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime) 
            values(?, ?, ?, ?, ?, ?, ?)`, 
    filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime);


    _internal_dict_[filePath] = {
        filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime
    };
}


module.exports.updateZipDb_v2 = function (info) {
    const { filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime} = info;

    sqldb.run(`INSERT OR REPLACE INTO zip_table (
            filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime) 
            values(?, ?, ?, ?, ?, ?, ?)`, 
    filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime);

    _internal_dict_[filePath] = {
        filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime
    };
}

const _internal_dict_ = {};
async function syncInternalDict(){
    const sql = `SELECT * FROM  zip_table`;
    let rows = await sqldb.allSync(sql)

    rows.forEach(e => {
        _internal_dict_[e.filePath] = e;
    })
}

module.exports.deleteFromZipDb = function (filePath) {
    const sql2 = `DELETE FROM  zip_table WHERE filePath = ?`;
    sqldb.runSync(sql2, [filePath])

    delete _internal_dict_[filePath]
}

const getZipInfo =  module.exports.getZipInfo = function (filePathes) {
    filePathes = _.isString(filePathes) ? [filePathes] : filePathes;
    filePathes = filePathes.filter(isCompress);

    let rows = filePathes.map(e => _internal_dict_[e]);
    return rows;
}
