const path = require('path');
const db = require('../models/db');
const logger = require('../config/logger');

async function updateByScan(dirPath, filePathes){
    try{
        const uniqueNames = Array.from(new Set(
            (Array.isArray(filePathes) ? filePathes : [])
                .filter(Boolean)
                .map(fp=>path.basename(fp))
        ));
        const rows = await db.getEstimateFilesInDir(dirPath);
        const oldSet = new Set(rows.map(r=>r.fileName));
        const newSet = new Set(uniqueNames);
        const toInsert = [];
        newSet.forEach(fn=>{
            if(!oldSet.has(fn)){
                toInsert.push({
                    filePath: dirPath,
                    fileName: fn
                });
            }
        });
        const toRemove = [];
        oldSet.forEach(fn=>{
            if(!newSet.has(fn)){
                toRemove.push(fn);
            }
        });
        if(toInsert.length){
            await db.addEstimateFiles(toInsert);
        }
        if(toRemove.length){
            await db.removeEstimateFiles(dirPath, toRemove);
        }
        await db.touchEstimateFiles(dirPath, uniqueNames);
    }catch(e){
        logger.error(e);
    }
}

async function onMove(src, dest){
    try{
        await db.removeEstimateFiles(path.dirname(src), [path.basename(src)]);
        await db.addEstimateFiles([
            {
                filePath: path.dirname(dest),
                fileName: path.basename(dest)
            }
        ]);
    }catch(e){
        logger.error(e);
    }
}

async function onDelete(src){
    try{
        await db.removeEstimateFiles(path.dirname(src), [path.basename(src)]);
    }catch(e){
        logger.error(e);
    }
}

module.exports = {
    updateByScan,
    onMove,
    onDelete
};
