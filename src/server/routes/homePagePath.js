
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
// const db = require("../models/db");
const isWindows = require('is-windows');
const util = global.requireUtil();
const historyDb = require("../models/historyDb");
const pathUtil = require("../pathUtil");
const memorycache = require('memory-cache');


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
        const getDownloadsFolder = require('downloads-folder');
        hdd_list.unshift(getDownloadsFolder());
    });
}

router.get('/api/homePagePath', async (req, res) => {
    const cacheKey = "homePagePathCacheKey";
    if(memorycache.get(cacheKey)){
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.send(memorycache.get(cacheKey))
        return;
    }

    let dirs = global.scan_path || [];
    // dirs = dirs.filter(e => {
    //     if (e) {
    //         const reg = escapeRegExp(e);
    //         //check if pathes really exist by checking there is file in the folder
    //         return !!getFileCollection().findOne({ 'filePath': { '$regex': reg }, isDisplayableInExplorer: true });
    //     }
    // });

    let tempQuickAccess = await historyDb.getQuickAccess();
    tempQuickAccess = tempQuickAccess.map(e => e.filePath);
    //不要和其他项目重复
    tempQuickAccess = tempQuickAccess.filter(e => {
        const e2 = pathUtil.removeLastPathSep(e);
        return !dirs.includes(e) && !hdd_list.includes(e) && !dirs.includes(e2) && !hdd_list.includes(e2);
    });
    let quickAccess = [];
    const NUM_QUICK_ACCESS = 15;
    for(let ii = 0; ii < tempQuickAccess.length; ii++){
        const pp = tempQuickAccess[ii];
        //确认是否存在
        if(await pathUtil.isExist(pp)){
            quickAccess.push(pp);
        }
        if(quickAccess.length >= NUM_QUICK_ACCESS){
            break;
        }
    }


    if (dirs.length === 0 && hdd_list.length === 0 && quickAccess.length === 0) {
        res.send({ failed: true, reason: "config-path.ini has no path" });
    } else {

        let result = {
            dirs,
            hdd_list,
            quickAccess
        }
        res.setHeader('Cache-Control', 'public, max-age=30');
        res.send(result);
        memorycache.put(cacheKey, result, 30 * 1000);
    }
});
module.exports = router;
