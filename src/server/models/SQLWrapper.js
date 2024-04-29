const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const logger = require("../logger");

class SQLWrapper extends sqlite3.Database {
    constructor(filePath) {
        super(filePath, (err) => {
            if (err) {
                logger.error("[SQLWrapper] Failed to open database at " + filePath);
                logger.error(err);
                throw err;
            }
            logger.info("[SQLWrapper] Database loaded successfully at " + filePath);
        });

        // Promisify async methods
        this.allSync = util.promisify(this.all).bind(this);
        this.getSync = util.promisify(this.get).bind(this);
        this.runSync = util.promisify(this.run).bind(this);
        this.execSync = util.promisify(this.exec).bind(this);

        // sqldb.allSync = _util.promisify(sqldb.all).bind(sqldb);
        // sqldb.getSync = _util.promisify(sqldb.get).bind(sqldb);
        // sqldb.runSync = _util.promisify(sqldb.run).bind(sqldb);
        // sqldb.execSync = _util.promisify(sqldb.exec).bind(sqldb);
    }

    async insertOneRow(tableName, rowObj) {
        if (!tableName || !rowObj) {
            console.warn("[SQLWrapper.insertOneRow] Invalid input");
            return;
        }
        const keys = Object.keys(rowObj);
        const values = keys.map(key => rowObj[key]);
        const placeholders = keys.map(() => '?').join(',');
        const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;
        await this.runSync(sql, values);
    }

    async batchInsert(tableName, dataArray, blockSize = 2000) {
        if (dataArray.length === 0) {
            return;
        }

        const blocks = Math.ceil(dataArray.length / blockSize);
        await this.execSync('BEGIN');
        try {
            for (let i = 0; i < blocks; i++) {
                const start = i * blockSize;
                const end = Math.min(start + blockSize, dataArray.length);
                const subArr = dataArray.slice(start, end);
                const keys = Object.keys(subArr[0]);
                const placeholders = '(' + keys.map(() => '?').join(',') + ')';
                const questions = new Array(subArr.length).fill(placeholders).join(',');
                const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES ${questions}`;
                const flatData = subArr.reduce((acc, cur) => [...acc, ...Object.values(cur)], []);
                await this.runSync(sql, flatData);
            }
            await this.execSync('COMMIT');
        } catch (e) {
            await this.execSync('ROLLBACK');
            console.error("[SQLWrapper.batchInsert] Error occurred during the transaction");
            console.error(e);
            throw e;
        }
    }
}

module.exports = SQLWrapper;
