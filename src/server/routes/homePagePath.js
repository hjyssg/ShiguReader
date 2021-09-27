
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
// const db = require("../models/db");
const isWindows = require('is-windows');
const util = global.requireUtil();
const historyDb = require("../models/historyDb");
const pathUtil = require("../pathUtil");


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

router.post('/api/homePagePath', async (req, res) => {
    // let beg = (new Date).getTime();
    let dirs = global.scan_path || [];
    // dirs = dirs.filter(e => {
    //     if (e) {
    //         const reg = escapeRegExp(e);
    //         //check if pathes really exist by checking there is file in the folder
    //         return !!getFileCollection().findOne({ 'filePath': { '$regex': reg }, isDisplayableInExplorer: true });
    //     }
    // });

    let quickAccess = await historyDb.getQuickAccess();
    quickAccess = quickAccess.map(e => e.dirPath);

    quickAccess = quickAccess.filter(e => {
        const e2 = pathUtil.removeLastPathSep(e);
        return !dirs.includes(e) && !hdd_list.includes(e) && !dirs.includes(e2) && !hdd_list.includes(e2);
    });

    quickAccess = quickAccess.slice(0, 10);

    if (dirs.length === 0 && hdd_list.length === 0 && quickAccess.length === 0) {
        res.send({ failed: true, reason: "config-path.ini has no path" });
    } else {
        res.send({
            dirs,
            hdd_list,
            quickAccess
        })
    }

    // let end1 = (new Date).getTime();
    // console.log(`${(end1 - beg)/1000}s to /api/homePagePath`);
});
module.exports = router;
