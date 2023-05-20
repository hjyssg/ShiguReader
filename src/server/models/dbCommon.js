const sql_lib = require('sqlite3');
const _util = require('util');

function getSQLInstance(filePath){
    console.log("[getSQLInstance] " + filePath);
    try{
        const sqlite3 = sql_lib.verbose();
        const sqlDb = new sqlite3.Database(filePath);
    
        //只用到下面这四个函数
        sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
        sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
        sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);
        // run()
        // console.log("loaded sql " + filePath);
        return sqlDb;
    }catch(e){
        console.error("[SQLite] failed to open "+ filePath)
        console.error(e);
        throw e;
    }

}

module.exports.getSQLInstance = getSQLInstance;