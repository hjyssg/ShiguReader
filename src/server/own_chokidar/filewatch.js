const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');


const getCurrentTime = function () {
    return new Date().getTime();
}

async function recursiveFileProcess({filePath, db, shouldIgnoreForNormal}) {
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

                if(shouldIgnoreForNormal(fullPath, stats)){
                    continue;
                }

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
    await processDirectory(filePath);

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
const addWatch = async ({ folderPath, deleteCallBack, shouldScan, db }) => {

    const shouldWatchIgnore = (fp, stat) => {
        if(!shouldScan(fp, stat)){
            return true;
        } else {
            if(stat && !stat.isDirectory()){
                 console.log(fp)
                return true;
            }
        }
    }

    const watcher = chokidar.watch(folderPath, {
        ignored: shouldWatchIgnore,
        persistent: true,
        ignorePermissionErrors: true,
        followSymlinks: false,
        disableGlobbing: true,
        ignoreInitial: true,
        useFsEvents: true
    });

  
    //处理添加文件事件
    const addFileCallBack = async (fp, stats) => {
        db.updateStatToDb(fp, stats);
    };

    const addFolderCallBack = async (fp, stats) => {
        db.updateStatToDb(fp, stats);
    };

    watcher
        .on('add', addFileCallBack)
        .on('change', addFileCallBack)
        .on('unlink', deleteCallBack);

    watcher
        .on('addDir', addFolderCallBack)
        .on('unlinkDir', deleteCallBack);

    watcher.on('ready', async () => {
        console.log(`[chokidar] ${folderPath} scan complete.`)
    })

    watchDescriptors[folderPath] = watcher;
    global.SCANED_PATH = Object.keys(watchDescriptors);
};



module.exports = { addWatch, recursiveFileProcess }