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

        // TODO sql -> statement
        // sqldb.statements = {};
        sqldb.insertOneRow = async function(tableName, rowObj){
            if(!tableName && !rowObj){
                console.warn("[sqldb.insertOneRow] WTF??");
            }
            const keys = Object.keys(rowObj);
            const values = keys.map(key => rowObj[key]);
            const placeholders = keys.map(() => '?');
            const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders.join(',')})`;
            await this.runSync(sql, values);
        }.bind(sqldb);


        sqldb.batchInsert = async function (tableName, dataArray, blockSize = 2000) {
            if(dataArray.length == 0){
                return;
            }
            // 计算分块数量
            const length = dataArray.length;
            const blocks = Math.ceil(length / blockSize);
            // 开始事务
            await this.runSync('BEGIN');
            for (let i = 0; i < blocks; i++) {
                const start = i * blockSize;
                const end = start + blockSize;
                const subArr = dataArray.slice(start, end);
                try{
                    // 拼接 SQL 语句
                    const keys = Object.keys(subArr[0]);
                    const placeholder = '(' + keys.map(() => '?') + ')';
                    const questions =  subArr.map(() => placeholder);
                    const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES ${questions.join(',')}`;
                    
                    // 执行 SQL 语句
                    const flatData = subArr.reduce((acc, cur) => acc.concat(Object.values(cur)), []);
                    await this.runSync(sql, flatData);
                    // console.log(tableName, start, end);
                }catch(e){
                    // debug
                    console.error(subArr, start);
                    console.error(e);
                    throw e;
                }
            }
            // 提交事务
            await this.runSync('COMMIT');
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