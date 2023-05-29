const sql_lib = require('sqlite3');
const _util = require('util');
const logger = require("../logger");


function getSQLInstance(filePath){
    logger.info("[getSQLInstance] " + filePath);
    try{
        const sqlite3 = sql_lib.verbose();
        const sqldb = new sqlite3.Database(filePath);
    
        //只用到下面这四个函数
        sqldb.allSync = _util.promisify(sqldb.all).bind(sqldb);
        sqldb.getSync = _util.promisify(sqldb.get).bind(sqldb);
        sqldb.runSync = _util.promisify(sqldb.run).bind(sqldb);
        // run()
        
        logger.info("[getSQLInstance] loaded " + filePath);
        return sqldb;
    }catch(e){
        logger.error("[SQLite] failed to open "+ filePath)
        logger.error(e);
        throw e;
    }

}

module.exports.getSQLInstance = getSQLInstance;