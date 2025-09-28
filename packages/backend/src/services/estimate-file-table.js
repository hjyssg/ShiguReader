const path = require('path');
const db = require('../models/db');
const logger = require('../config/logger');

async function updateByScan(filePathes){
    try{
        if(filePathes.length === 0){
            return;
        }

        const grouped = new Map();
        filePathes.forEach(fp=>{
            const dirPath = path.dirname(fp);
            if(!grouped.has(dirPath)){
                grouped.set(dirPath, new Set());
            }
            grouped.get(dirPath).add(path.basename(fp));
        });

        filePathes.forEach(fp=>{
            if(!grouped.has(fp)){
                grouped.set(fp, new Set());
            }
        });

        for(const [dirPath, nameSet] of grouped.entries()){
            const uniqueNames = Array.from(nameSet);
            const rows = await db.getEstimateFilesInDir(dirPath);
            const oldSet = new Set(rows.map(r=>r.fileName));

            const toInsert = uniqueNames
                .filter(fn=>!oldSet.has(fn))
                .map(fn=>({ filePath: dirPath, fileName: fn }));
            const toRemove = Array.from(oldSet).filter(fn=>!nameSet.has(fn));

            if(toInsert.length){
                await db.addEstimateFiles(toInsert);
            }
            if(toRemove.length){
                await db.removeEstimateFiles(dirPath, toRemove);
            }
            if(uniqueNames.length){
                await db.touchEstimateFiles(dirPath, uniqueNames);
            }
        }
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
