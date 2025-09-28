const path = require('path');
const estimateFileDb = require('../models/estimate-file-db');
const logger = require('../config/logger');

async function updateByScan(filePathes){
    try{
        if(!filePathes || filePathes.length === 0){
            return;
        }

        const rows = Array.from(new Set(filePathes))
            .filter(Boolean)
            .map(fp => ({
                filePath: fp,
                fileName: path.basename(fp)
            }));

        await estimateFileDb.addEstimateFiles(rows);
    }catch(e){
        logger.error(e);
    }
}

module.exports = {
    updateByScan
};
