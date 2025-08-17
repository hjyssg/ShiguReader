const db = require('./models/db');
const path = require('path');

async function updateByScan(dir, currentPaths) {
    try {
        const rows = await db.getEstimateFilesInDir(dir);
        const currentSet = new Set(currentPaths.map(p => path.resolve(p)));
        const dbSet = new Set(rows.map(r => r.filePath));

        await db.addEstimateFiles([...currentSet]);

        const toRemove = [];
        for (const fp of dbSet) {
            if (!currentSet.has(fp)) {
                toRemove.push(fp);
            }
        }
        if (toRemove.length) {
            await db.markEstimateFilesRemoved(toRemove);
        }
    } catch (err) {
        console.error('[estimateFileTable.updateByScan]', err);
    }
}

async function onMove(src, dest) {
    try {
        await db.markEstimateFilesRemoved([src]);
        if (dest) {
            await db.addEstimateFiles([dest]);
        }
    } catch (err) {
        console.error('[estimateFileTable.onMove]', err);
    }
}

async function onDelete(src) {
    try {
        await db.markEstimateFilesRemoved([src]);
    } catch (err) {
        console.error('[estimateFileTable.onDelete]', err);
    }
}

module.exports = {
    updateByScan,
    onMove,
    onDelete,
};
