const Database = require('better-sqlite3');
const logger = require("../config/logger");

class SQLWrapper {
    constructor(filePath) {
        try {
            this.db = new Database(filePath);
            logger.info("[SQLWrapper] Database loaded successfully at " + filePath);
        } catch (err) {
            logger.error("[SQLWrapper] Failed to open database at " + filePath);
            logger.error(err);
            throw err;
        }
    }

    static _normalizeParams(params) {
        if (params === undefined || params === null) {
            return [];
        }
        return Array.isArray(params) ? params : [params];
    }

    async allSync(sql, params) {
        const statement = this.db.prepare(sql);
        const normalized = SQLWrapper._normalizeParams(params);
        return statement.all(...normalized);
    }

    async getSync(sql, params) {
        const statement = this.db.prepare(sql);
        const normalized = SQLWrapper._normalizeParams(params);
        return statement.get(...normalized);
    }

    async runSync(sql, params) {
        const statement = this.db.prepare(sql);
        const normalized = SQLWrapper._normalizeParams(params);
        return statement.run(...normalized);
    }

    async execSync(sql) {
        this.db.exec(sql);
    }

    prepare(sql) {
        const statement = this.db.prepare(sql);
        statement.allSync = async (params) => {
            const normalized = SQLWrapper._normalizeParams(params);
            return statement.all(...normalized);
        };
        statement.getSync = async (params) => {
            const normalized = SQLWrapper._normalizeParams(params);
            return statement.get(...normalized);
        };
        statement.runSync = async (params) => {
            const normalized = SQLWrapper._normalizeParams(params);
            return statement.run(...normalized);
        };
        return statement;
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
