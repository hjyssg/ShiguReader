const fs = require('fs').promises;
const path = require('path');
const fsWalk = require('@nodelib/fs.walk');
const watcher = require('@parcel/watcher');
const pathUtil = require("../../utils/path-util");
const appState = require('../../state/appState');
const estimateFileTable = require('../estimate-file-table');

const getCurrentTime = function () {
    return new Date().getTime();
}

/**
 * 使用 @nodelib/fs.walk 进行高性能文件遍历
 */
async function fastFileIterate({ filePath, db, shouldIgnoreForNormal }) {
    let beg = getCurrentTime();

    // 缓存对象，用于存储文件和标签数据
    const insertion_cache = {
        files: [],
        tags: []
    };

    console.log(`[fastFileIterate] ${filePath}  begin`);

    try {
        // 使用 @nodelib/fs.walk 的 Promise 接口进行异步遍历
        const entries = await new Promise((resolve, reject) => {
            fsWalk.walk(filePath, {
                stats: true,
                deepFilter: (entry) => {
                    // 过滤掉需要忽略的目录
                    return !shouldIgnoreForNormal(entry.path, entry.stats);
                },
                entryFilter: (entry) => {
                    // 过滤掉需要忽略的文件和目录
                    return !shouldIgnoreForNormal(entry.path, entry.stats);
                }
            }, (err, entries) => {
                if (err) reject(err);
                else resolve(entries);
            });
        });

        // 处理所有条目
        for (const entry of entries) {
            db.updateStatToDb(entry.path, entry.stats, insertion_cache);
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
    console.log(`[fastFileIterate] ${insertion_cache.files.length} files were scanned.  ${(end1 - beg) / 1000}s`);
    console.log("----------------------------------------------------------------");
    console.log(`\n\n\n`);
}


// 用于存储当前所有监听的 subscription
let watchDescriptors = {};

/**
 * 使用 @parcel/watcher 添加目录监听
 */
const addWatch = async ({ folderPath, deleteCallBack, shouldScan, db }) => {
    const startTime = Date.now();

    try {
        const subscription = await watcher.subscribe(folderPath, async (err, events) => {
            if (err) {
                console.error('[parcel/watcher] Error:', err);
                return;
            }

            for (const event of events) {
                try {
                    if (event.type === 'create' || event.type === 'update') {
                        // 文件新增或修改
                        const stats = await fs.stat(event.path);
                        if (shouldScan && !shouldScan(event.path, stats)) {
                            continue;
                        }
                        db.updateStatToDb(event.path, stats);
                    } else if (event.type === 'delete') {
                        // 文件删除
                        deleteCallBack(event.path);
                    }
                } catch (eventError) {
                    // 文件可能在处理时被删除，忽略错误
                    if (eventError.code !== 'ENOENT') {
                        console.error('[parcel/watcher] Event processing error:', eventError);
                    }
                }
            }
        });

        console.log(`[parcel/watcher] ${folderPath} watcher set up. Time taken: ${Date.now() - startTime} ms`);

        watchDescriptors[folderPath] = subscription;
        appState.setScannedPaths(Object.keys(watchDescriptors).sort((a, b) => b.localeCompare(a)));
    } catch (error) {
        console.error('[parcel/watcher] Failed to subscribe:', folderPath, error);
    }
};

/**
 * 移除目录监听，释放资源
 */
const removeWatch = async (folderPath) => {
    const subscription = watchDescriptors[folderPath];
    if (subscription) {
        await subscription.unsubscribe();
        delete watchDescriptors[folderPath];
        appState.setScannedPaths(Object.keys(watchDescriptors).sort((a, b) => b.localeCompare(a)));
        console.log(`[parcel/watcher] ${folderPath} watcher removed.`);
    }
};

/**
 * 移除所有监听，用于服务销毁时清理
 */
const removeAllWatches = async () => {
    const paths = Object.keys(watchDescriptors);
    for (const folderPath of paths) {
        await removeWatch(folderPath);
    }
};

const { pathEqual } = require('path-equal');
/** 判断一个dir path是不是在scan路径上 */
function isAlreadyScan(dir) {
    const scannedPaths = appState.getScannedPaths();
    return dir && scannedPaths.some(sp => {
        return pathEqual(sp, dir) || pathUtil.isSub(sp, dir);
    });
}


module.exports = { addWatch, fastFileIterate, isAlreadyScan, removeWatch, removeAllWatches }
