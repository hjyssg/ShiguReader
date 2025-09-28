const util = require('../common/util');

let sqldb;

module.exports.init = async (_sqldb) => {
    sqldb = _sqldb;
    await sqldb.execSync(`
        CREATE TABLE IF NOT EXISTS estimate_file_table (
            filePath TEXT,
            fileName TEXT,
            scan_time INTEGER,
            PRIMARY KEY (filePath, fileName)
        );
        CREATE INDEX IF NOT EXISTS eft_fileName_index ON estimate_file_table (fileName);
        CREATE INDEX IF NOT EXISTS eft_filePath_index ON estimate_file_table (filePath);
    `);
};

module.exports.addEstimateFiles = async function(rows){
    if(!rows || rows.length === 0){
        return;
    }
    const time = util.getCurrentTime();
    const payload = rows.map(r => ({
        filePath: r.filePath,
        fileName: r.fileName,
        scan_time: time
    }));
    await sqldb.batchInsert('estimate_file_table', payload);
};

module.exports.removeEstimateFiles = async function(filePath, fileNames){
    if(!fileNames || fileNames.length === 0){
        return;
    }
    const placeholders = fileNames.map(() => '?').join(',');
    const sql = `DELETE FROM estimate_file_table WHERE filePath=? AND fileName IN (${placeholders})`;
    await sqldb.runSync(sql, [filePath, ...fileNames]);
};

module.exports.touchEstimateFiles = async function(filePath, fileNames){
    if(!fileNames || fileNames.length === 0){
        return;
    }
    const placeholders = fileNames.map(() => '?').join(',');
    const sql = `UPDATE estimate_file_table SET scan_time=? WHERE filePath=? AND fileName IN (${placeholders})`;
    await sqldb.runSync(sql, [util.getCurrentTime(), filePath, ...fileNames]);
};

module.exports.getEstimateFilesInDir = async function(filePath){
    const sql = `SELECT * FROM estimate_file_table WHERE filePath=?`;
    return await sqldb.allSync(sql, [filePath]);
};

module.exports.findEstimateByText = async function(text){
    const sql = `SELECT fileName FROM estimate_file_table WHERE fileName LIKE ?`;
    return await sqldb.allSync(sql, [`%${text}%`]);
};
