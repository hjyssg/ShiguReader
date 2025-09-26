const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const pathUtil = require("../../utils/pathUtil");


const getCurrentTime = function () {
    return new Date().getTime();
}

async function fastFileIterate({filePath, db, shouldIgnoreForNormal}) {
    let beg = getCurrentTime();

    // 缓存对象，用于存储文件和标签数据
    const insertion_cache = {
        files: [],
        tags: []
    };

    console.log(`[fastFileIterate] ${filePath}  begin`);

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

    //  删除地址现有的全部data
    await db.runSync("DELETE FROM file_table where filePath LIKE ?", [(filePath + '%')]);
    await db.runSync("DELETE FROM tag_file_table where filePath LIKE ?", [(filePath + '%')]);

    // 所有文件处理完成后，批量插入数据库
    await db.batchInsert("file_table", insertion_cache.files);
    await db.batchInsert("tag_file_table", insertion_cache.tags);
    await db.throttledSyncTagTable();

    let end1 = getCurrentTime();
    console.log(`[fastFileIterate] ${insertion_cache.files.length} files were scanned.  ${(end1 - beg) / 1000}s`);
    console.log("----------------------------------------------------------------");
    console.log(`\n\n\n`);
}


// 用于存储当前所有监听的目录
let watchDescriptors = {};

// 动态添加监听目录
const addWatch_chokidar = async ({ folderPath, deleteCallBack, shouldScan, db }) => {
    const startTime = Date.now();  // 设置开始时间
    const shouldWatchIgnore = (fp, stat) => {
        if(!shouldScan(fp, stat)){
            return true;
        } else {
            // if(stat && !stat.isDirectory()){
            //      console.log(fp)
            //     return true;
            // }
            // ignore文件，之后文件变化就不会通知。但创建几千个文件的watch又会卡
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
        // console.log(`[chokidar] ${folderPath} watcher set up.`)
        const endTime = Date.now();
        console.log(`[chokidar] ${folderPath} watcher set up. Time taken: ${endTime - startTime} ms`);
    })

    watchDescriptors[folderPath] = watcher;
    global.SCANED_PATH = Object.keys(watchDescriptors);
};

const sane = require('sane');  // 性能确实比chokidar好
const addWatch_sane = async ({ folderPath, deleteCallBack, shouldScan, db }) => {
    // 或许使用https://facebook.github.io/watchman/docs/install
    const startTime = Date.now();  // 设置开始时间
    const shouldWatchIgnore = (fp, stat) => {
        if(!shouldScan(fp, stat)){
            return true;
        } else {
            // if(stat && !stat.isDirectory()){
            //      console.log(fp)
            //     return true;
            // }
            // ignore文件，之后文件变化就不会通知。但创建几千个文件的watch又会卡
        }
    }

    const watcher = sane(folderPath, {
        glob: ['**/*'], // 监视所有文件和目录，可以根据需要调整
        poll: false,    // 根据需求选择是否使用轮询
        ignored: shouldWatchIgnore,
        dot: false      // 是否监视点文件（隐藏文件）
    });

    //处理文件或目录添加事件
    const addCallBack = async (fp, root, stat) => {
        fp = path.resolve(root, fp);
        db.updateStatToDb(fp, stat);
    };

    const _deleteCallBack =  async (fp, root)=>{
        fp = path.resolve(root, fp);
        deleteCallBack(fp);
    }

    watcher.on('add', addCallBack)
           .on('change', addCallBack)
           .on('delete', _deleteCallBack);

    watcher.on('ready', () => {
            const endTime = Date.now();
            console.log(`[sane] ${folderPath} watcher set up. Time taken: ${endTime - startTime} ms`);
    });

    watchDescriptors[folderPath] = watcher;
    global.SCANED_PATH = Object.keys(watchDescriptors).sort((a, b) => b.localeCompare(a));
};

const { pathEqual } = require('path-equal');
/** 判断一个dir path是不是在scan路径上 */
function isAlreadyScan(dir) {
    return dir && global.SCANED_PATH.some(sp => {
        return pathEqual(sp, dir) || pathUtil.isSub(sp, dir);
    });
}


module.exports = { addWatch: addWatch_sane, fastFileIterate, isAlreadyScan }
