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
        sqldb.execSync = _util.promisify(sqldb.exec).bind(sqldb);
        // run()

        sqldb.insertOneRow = async function(tableName, rowObj){
            const keys = Object.keys(rowObj);
            const values = keys.map(key => rowObj[key]);
            const placeholders = keys.map(() => '?');
            const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders.join(',')})`;
            await this.runSync(sql, values);
        }.bind(sqldb);
        
        logger.info("[getSQLInstance] loaded " + filePath);
        return sqldb;
    }catch(e){
        logger.error("[SQLite] failed to open "+ filePath)
        logger.error(e);
        throw e;
    }

}

module.exports.getSQLInstance = getSQLInstance;