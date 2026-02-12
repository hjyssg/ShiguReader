const fs = require('fs').promises;
const path = require('path');
const watcher = require('@parcel/watcher');
const pathUtil = require("../../utils/path-util");
const appState = require('../../state/appState');
const estimateFileTable = require('../estimate-file-table');
const logger = require('../../config/logger');


const getCurrentTime = function () {
    return new Date().getTime();
}

async function fastFileIterate({ filePath, db, shouldIgnoreForNormal }) {
    let beg = getCurrentTime();

    // 缓存对象，用于存储文件和标签数据
    const insertion_cache = {
        files: [],
        tags: []
    };

    logger.info(`[fastFileIterate] ${filePath}  begin`);

    try {
        // 使用 Node.js 20+ 原生递归读取目录
        const entries = await fs.readdir(filePath, { recursive: true, withFileTypes: true });

        for (let entry of entries) {
            const fullPath = path.join(entry.parentPath, entry.name);

            // 获取 stats 以保持逻辑兼容
            let stats;
            try {
                stats = await fs.stat(fullPath);
            } catch (e) {
                // 如果文件在扫描期间被删除，跳过
                continue;
            }

            if (shouldIgnoreForNormal(fullPath, stats)) {
                continue;
            }

            // 更新状态到数据库的缓存
            db.updateStatToDb(fullPath, stats, insertion_cache);
        }
    } catch (error) {
        console.error('Error processing directory:', filePath, error);
    }

    //  删除地址现有的全部data
    await db.runSync("DELETE FROM file_table where filePath LIKE ?", [(filePath + '%')]);
    await db.runSync("DELETE FROM tag_file_table where filePath LIKE ?", [(filePath + '%')]);

    // 所有文件处理完成后，批量插入数据库
    await db.batchInsert("file_table", insertion_cache.files);
    await estimateFileTable.updateByScan(
        insertion_cache.files
            .map(item => item.filePath)
    );
    await db.batchInsert("tag_file_table", insertion_cache.tags);
    await db.throttledSyncTagTable();

    let end1 = getCurrentTime();
    logger.info(`[fastFileIterate] ${insertion_cache.files.length} files were scanned.  ${(end1 - beg) / 1000}s`);
    logger.info("----------------------------------------------------------------");
    logger.info(`\n\n\n`);

    console.log(`[fastFileIterate] ${insertion_cache.files.length} files were scanned.  ${(end1 - beg) / 1000}s`);
}


// 用于存储当前所有监听的目录
let watchDescriptors = {};

// 动态添加监听目录
const addWatch = async ({ folderPath, deleteCallBack, shouldScan, db }) => {
    const startTime = Date.now();

    const subscription = await watcher.subscribe(folderPath, async (err, events) => {
        if (err) {
            console.error(`[@parcel/watcher] Error watching ${folderPath}:`, err);
            return;
        }

        for (const event of events) {
            const { path: fp, type } = event;

            try {
                if (type === 'delete') {
                    deleteCallBack(fp);
                } else {
                    // create 或 update
                    const stats = await fs.stat(fp);
                    if (shouldScan(fp, stats)) {
                        db.updateStatToDb(fp, stats);
                    }
                }
            } catch (e) {
                // 如果是 stat 失败（可能是因为文件刚创建就被删除），则视为删除或忽略
                if (type !== 'delete') {
                    deleteCallBack(fp);
                }
            }
        }
    });

    const endTime = Date.now();
    logger.info(`[@parcel/watcher] ${folderPath} watcher set up. Time taken: ${endTime - startTime} ms`);

    watchDescriptors[folderPath] = subscription;
    appState.setScannedPaths(Object.keys(watchDescriptors).sort((a, b) => b.localeCompare(a)));
};

/** 关闭所有监听器 */
const stopAllWatches = async () => {
    for (const folderPath in watchDescriptors) {
        const subscription = watchDescriptors[folderPath];
        if (subscription && typeof subscription.unsubscribe === 'function') {
            await subscription.unsubscribe();
        }
    }
    watchDescriptors = {};
};

const { pathEqual } = require('path-equal');
/** 判断一个dir path是不是在scan路径上 */
function isAlreadyScan(dir) {
    const scannedPaths = appState.getScannedPaths();
    return dir && scannedPaths.some(sp => {
        return pathEqual(sp, dir) || pathUtil.isSub(sp, dir);
    });
}


module.exports = { addWatch, fastFileIterate, isAlreadyScan, stopAllWatches }

