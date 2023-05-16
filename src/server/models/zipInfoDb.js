const util = global.requireUtil();
const { isImage, isMusic, isCompress, isVideo } = util;
const _ = require('underscore');

const userConfig = global.requireUserConfig();
const path = require('path');
const pathUtil = require("../pathUtil");

const rootPath = pathUtil.getRootPath();
// const Loki = require("lokijs");
// let loki_db;
// let zip_content_db;
// let zip_content_db_path = path.join(rootPath, userConfig.workspace_name, "zip_info");

// implement the autoloadback referenced in loki constructor
// function databaseInitialize() {
//     zip_content_db = loki_db.getCollection("zipInfo");
//     if (zip_content_db === null) {
//         zip_content_db = loki_db.addCollection("zipInfo", { indices: ['filePath'] });
//     }
//     const entryCount = zip_content_db.count();
//     console.log("[zipInfoDb] number of entries in database : " + entryCount);

//     const entries = zip_content_db.find();
//     entries.forEach(e => {
//         updateZipDb(e);
//     })
// }

// loki_db = new Loki(zip_content_db_path, {
//     autoload: true,
//     autoloadCallback: databaseInitialize,
//     autosave: true,
//     autosaveInterval: 4000
// });

let zip_sql_path = path.join(rootPath, userConfig.workspace_name, "zip_info_sql.db");
const dbCommon = require("./dbCommon");
const sqlDb = dbCommon.getSQLInstance(zip_sql_path);

//-----------------------
module.exports.init = async ()=> {
    await sqlDb.runSync(`CREATE TABLE IF NOT EXISTS zip_table (
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

    sqlDb.run(`INSERT OR REPLACE INTO zip_table (
            filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime) 
            values(?, ?, ?, ?, ?, ?, ?)`, 
    filePath, pageNum, musicNum, videoNum, totalNum, totalImgSize, mtime);
    _internal_dict_[filePath] = info;
}

const _internal_dict_ = {};
async function syncInternalDict(){
    const sql = `SELECT * FROM  zip_table`;
    let rows = await sqlDb.allSync(sql)

    rows.forEach(e => {
        _internal_dict_[e.filePath] = e;
    })
}

module.exports.deleteFromZipDb = function (filePath) {
    const sql2 = `DELETE FROM  zip_table WHERE filePath = ?`;
    sqlDb.runSync(sql2, [filePath])

    delete _internal_dict_[filePath]
}

const getZipInfo =  module.exports.getZipInfo = function (filePathes) {
    filePathes = _.isString(filePathes) ? [filePathes] : filePathes;
    filePathes = filePathes.filter(isCompress);

    let rows = filePathes.map(e => _internal_dict_[e]);
    return rows;
}
