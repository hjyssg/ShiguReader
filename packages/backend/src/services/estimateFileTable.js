const path = require('path');
const pfs = require('promise-fs');
const db = require('./models/db');
const logger = require('../config/logger');

async function updateByScan(dirPath){
    try{
        const names = await pfs.readdir(dirPath);
        const rows = await db.getEstimateFilesInDir(dirPath);
        const oldSet = new Set(rows.filter(r=>!r.isRemoved).map(r=>r.fileName));
        const newSet = new Set(names);
        const toInsert = [];
        newSet.forEach(fn=>{
            if(!oldSet.has(fn)){
                toInsert.push({
                    dirName: path.basename(dirPath),
                    dirPath,
                    fileName: fn,
                    isRemoved: 0
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
            await db.markEstimateFilesRemoved(dirPath, toRemove);
        }
        await db.touchEstimateFiles(dirPath, names);
    }catch(e){
        logger.error(e);
    }
}

async function onMove(src, dest){
    try{
        await db.markEstimateFilesRemoved(path.dirname(src), [path.basename(src)]);
        await db.addEstimateFiles([
            {
                dirName: path.basename(path.dirname(dest)),
                dirPath: path.dirname(dest),
                fileName: path.basename(dest),
                isRemoved: 0
            }
        ]);
    }catch(e){
        logger.error(e);
    }
}

async function onDelete(src){
    try{
        await db.markEstimateFilesRemoved(path.dirname(src), [path.basename(src)]);
    }catch(e){
        logger.error(e);
    }
}

module.exports = {
    updateByScan,
    onMove,
    onDelete
};
