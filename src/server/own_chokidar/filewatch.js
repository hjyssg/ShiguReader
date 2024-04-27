const fs = require('fs').promises;
const _fs = require('fs');
const path = require('path');

const getCurrentTime = function () {
    return new Date().getTime();
}

async function recursiveFileProcess({filepath, db, shouldIgnoreForNormal}) {
    let beg = getCurrentTime();

    // 缓存对象，用于存储文件和标签数据
    const insertion_cache = {
        files: [],
        tags: []
    };


    // 递归函数，用于处理文件和文件夹
    async function processDirectory(dirPath) {
        try {
            // 读取目录中的所有项
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            // 遍历目录项
            for (let entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const stats = await fs.stat(fullPath);
                
                // 更新状态到数据库的缓存
                db.updateStatToDb(fullPath, stats, insertion_cache);

                // 如果是目录，递归调用
                if (entry.isDirectory()) {
                    await processDirectory(fullPath);
                }
            }
        } catch (error) {
            console.error('Error processing directory:', dirPath, error);
        }
    }

    // 开始递归处理
    await processDirectory(filepath);

    // 所有文件处理完成后，批量插入数据库
    await db.batchInsert("file_table", insertion_cache.files);
    await db.batchInsert("tag_table", insertion_cache.tags);

    let end1 = getCurrentTime();
    console.log(`[recursiveFileProcess] ${(end1 - beg) / 1000}s scan complete.`);
    console.log(`[recursiveFileProcess] ${insertion_cache.files.length} files were scanned`)
    console.log("----------------------------------------------------------------");
    console.log(`\n\n\n`);
}


// 用于存储当前所有监听的目录
let watchDescriptors = {};

// 动态添加监听目录
const addWatch = async ({ folderPath, addFileCallBack, addFolderCallBack, deleteFileCallBack, deleteFolderCallBack, shouldIgnoreForNormal }) => {
    const watcher = _fs.watch(folderPath, { persistent: true, recursive: true }, async (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(folderPath, filename);
        console.log(eventType, fullPath);

        try {
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
                if (eventType === 'rename' && !watchDescriptors[fullPath]) {
                    // 新增目录
                    addFolderCallBack(fullPath, stats);
                }
            } else if (stats.isFile()) {
                if (eventType === 'rename') {
                    // 新增文件
                    addFileCallBack(fullPath, stats);
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件或目录被删除
                if (watchDescriptors[fullPath]) {
                    deleteFolderCallBack(fullPath);
                    watcher.close(); // 停止监听已删除的目录
                    delete watchDescriptors[fullPath];
                } else {
                    deleteFileCallBack(fullPath);
                }
            } else {
                console.error(`Error watching file ${fullPath}:`, error);
            }
        }
    });

    console.log(folderPath, watcher)
    watchDescriptors[folderPath] = watcher;
};

// TODO
function get_scan_path() {
    return Object.keys(watchDescriptors);
}

module.exports = { addWatch, recursiveFileProcess }