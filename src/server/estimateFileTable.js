const db = require('./models/db');
const path = require('path');

function updateByScan(dir, currentPaths){
    db.getEstimateFilesInDir(dir).then(rows => {
        const currentSet = new Set(currentPaths.map(p => path.resolve(p)));
        const dbSet = new Set(rows.map(r => r.filePath));

        db.addEstimateFiles([...currentSet]).catch(err => console.error(err));

        const toRemove = [];
        for (const fp of dbSet) {
            if (!currentSet.has(fp)) {
                toRemove.push(fp);
            }
        }
        if (toRemove.length) {
            db.markEstimateFilesRemoved(toRemove).catch(err => console.error(err));
        }
    }).catch(err => console.error('[estimateFileTable.updateByScan]', err));
}

function onMove(src, dest){
    db.markEstimateFilesRemoved([src]).catch(err => console.error(err));
    if(dest){
        db.addEstimateFiles([dest]).catch(err => console.error(err));
    }
}

function onDelete(src){
    db.markEstimateFilesRemoved([src]).catch(err => console.error(err));
}

module.exports = {
    updateByScan,
    onMove,
    onDelete,
};
