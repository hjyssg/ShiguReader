
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const isWindows = require('is-windows');
const util = global.requireUtil();
const historyDb = require("../models/historyDb");
const pathUtil = require("../pathUtil");
const memorycache = require('memory-cache');
const path = require("path");
const { pathEqual } = require('path-equal');

const getDownloadsFolder = require('downloads-folder');
let downloadFolder = getDownloadsFolder();

let hdd_list = [];
if (isWindows()) {
    //https://stackoverflow.com/questions/15878969/enumerate-system-drives-in-nodejs
    const child = require('child_process');
    child.exec('wmic logicaldisk get name', (error, stdout) => {
        if (error) {
            return;
        }

        hdd_list = stdout.split('\r\r\n')
            .filter(util.isWindowsPath)
            .map(value => value.trim());

        //no c drive
        hdd_list = hdd_list.filter(e => !e.toLocaleLowerCase().startsWith("c"));
        // hdd_list = hdd_list.map(e => path.resolve(e));
        // F: 的时候，会莫名其妙显示shigureader文件夹的内容
        hdd_list = hdd_list.map(e => e + "\\\\");
    });
}


function containPath(pathList, fp){
    return pathList.some(e =>  {
        return pathEqual(e, fp)
    });
}

router.get('/api/homePagePath', serverUtil.asyncWrapper(async (req, res) => {
    const cacheKey = "homePagePathCacheKey";
    if(memorycache.get(cacheKey)){
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.send(memorycache.get(cacheKey))
        return;
    }

    // dirs
    let dirs = await db.getAllScanPath();

    // quick Access
    let quickAccess = global.quick_access_pathes;
    quickAccess.push(downloadFolder);
    //不要和其他项目重复
    quickAccess = quickAccess.filter(e => {
        return !containPath(dirs, e) && !containPath(hdd_list, e);
    });

    // recent access path
    let recentAccess = await historyDb.getRecentAccess();
    recentAccess = recentAccess.map(e => e.filePath);
    // 不要和其他项目重复
    recentAccess = recentAccess.filter(e => {
        return !containPath(dirs, e) && !containPath(hdd_list, e) && !containPath(quickAccess, e);
    });
    const NUM_QUICK_ACCESS = 10;
    recentAccess = await pathUtil.filterNonExist(recentAccess, NUM_QUICK_ACCESS);
  

    if (dirs.length === 0 && hdd_list.length === 0 && quickAccess.length === 0 && recentAccess.length == 0) {
        res.send({ failed: true, reason: "config-path.ini has no path" });
    } else {
        let result = {
            dirs,
            hdd_list,
            quickAccess,
            recentAccess
        }
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.send(result);
        memorycache.put(cacheKey, result, 30 * 1000);
    }
}));
module.exports = router;
