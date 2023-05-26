
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const util = global.requireUtil();
const historyDb = require("../models/historyDb");
const pathUtil = require("../pathUtil");
const memorycache = require('memory-cache');
const path = require("path");
const _ = require('underscore');
const { pathEqual } = require('path-equal');


function containPath(pathList, fp){
    return pathList.some(e =>  {
        return pathEqual(e, fp)
    });
}

function normalizePath(pathes){
    pathes =  pathes || [];
    pathes = pathes.map(e => path.resolve(e));
    return _.uniq(pathes);
}

router.get('/api/homePagePath', serverUtil.asyncWrapper(async (req, res) => {
    const cacheKey = "homePagePathCacheKey";
    const TIME_OUT = 20;
    if(memorycache.get(cacheKey)){
        res.setHeader('Cache-Control', `public, max-age=${TIME_OUT}`);
        res.send(memorycache.get(cacheKey))
        return;
    }

    let hdd_list = global.hdd_list;
    let scan_pathes = global.SCANED_PATH; //await db.getAllScanPath();

    // quick Access
    let quickAccess = global.quick_access_pathes;
    //不要和其他项目重复
    quickAccess = quickAccess.filter(e => {
        return !containPath(scan_pathes, e) && !containPath(hdd_list, e);
    });
    quickAccess = _.uniq(quickAccess);

    // recent access path
    let recentAccess = await historyDb.getRecentAccess();
    recentAccess = recentAccess.map(e => e.filePath);
    // 不要和其他项目重复
    recentAccess = recentAccess.filter(e => {
        return !containPath(scan_pathes, e) && !containPath(hdd_list, e) && !containPath(quickAccess, e);
    });
    const NUM_QUICK_ACCESS = 10;
    recentAccess = await pathUtil.filterNonExist(recentAccess, NUM_QUICK_ACCESS);
  

    if (scan_pathes.length === 0 && hdd_list.length === 0 && quickAccess.length === 0 && recentAccess.length == 0) {
        res.send({ failed: true, reason: "config-path.ini has no path" });
    } else {
        let result = {
            dirs: normalizePath(scan_pathes),
            hdd_list: normalizePath(hdd_list),
            quickAccess: normalizePath(quickAccess),
            recentAccess: normalizePath(recentAccess)
        }
        res.setHeader('Cache-Control', `public, max-age=${TIME_OUT}`);
        res.send(result);
        memorycache.put(cacheKey, result, TIME_OUT * 1000);
    }
}));
module.exports = router;
