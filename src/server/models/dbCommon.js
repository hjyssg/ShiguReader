const sql_lib = require('sqlite3');
const _util = require('util');
const logger = require("../logger");


function getSQLInstance(filePath){
    logger.info("[getSQLInstance] " + filePath);
    try{
        const sqlite3 = sql_lib.verbose();
        const sqlDb = new sqlite3.Database(filePath);
    
        //只用到下面这四个函数
        sqlDb.allSync = _util.promisify(sqlDb.all).bind(sqlDb);
        sqlDb.getSync = _util.promisify(sqlDb.get).bind(sqlDb);
        sqlDb.runSync = _util.promisify(sqlDb.run).bind(sqlDb);
        // run()
        
        logger.info("[getSQLInstance] loaded " + filePath);
        return sqlDb;
    }catch(e){
        logger.error("[SQLite] failed to open "+ filePath)
        logger.error(e);
        throw e;
    }

}

module.exports.getSQLInstance = getSQLInstance;