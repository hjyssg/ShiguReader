
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");

const util = global.requireUtil();
const isWindows = require('is-windows');
const historyDb = require("../models/historyDb");

let hdd_list = [];
if(isWindows()){
    //https://stackoverflow.com/questions/15878969/enumerate-system-drives-in-nodejs
    const child = require('child_process');
    child.exec('wmic logicaldisk get name', (error, stdout) => {
        if(error){
            return;
        }

        hdd_list = stdout.split('\r\r\n')
                .filter(value => /[A-Za-z]:/.test(value))
                .map(value => value.trim());


        //no c drive
        hdd_list = hdd_list.filter(e => !e.toLocaleLowerCase().startsWith("c"));
        const getDownloadsFolder = require('downloads-folder');
        hdd_list.unshift(getDownloadsFolder());
    });
}

router.post('/api/homePagePath', async function (req, res) {
    let beg = (new Date).getTime();
    let dirs = global.scan_path;
    // dirs = dirs.filter(e => {
    //     if (e) {
    //         const reg = escapeRegExp(e);
    //         //check if pathes really exist by checking there is file in the folder
    //         return !!getFileCollection().findOne({ 'filePath': { '$regex': reg }, isDisplayableInExplorer: true });
    //     }
    // });

    let quickAccess = await  historyDb.getQuickAccess();
    quickAccess = quickAccess.map(e => e.dirPath).slice(0, 10);

    if (dirs.length === 0 && hdd_list.length === 0 && quickAccess.length === 0) {
        res.send({ failed: true, reason: "path-config.ini has no path" });
    } else {
        res.send({
            dirs,
            hdd_list,
            quickAccess
        })
    }

    let end1 = (new Date).getTime();
    // console.log(`${(end1 - beg)/1000}s to /api/homePagePath`);
});
module.exports = router;
