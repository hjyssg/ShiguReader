
const path = require('path');
const express = require('express');
const router = express.Router();
const db = require("../models/db");
// const util = global.requireUtil();
// const { isCompress } = util;
// const zipInfoDb = require("../models/zipInfoDb");
const serverUtil = require("../utils/serverUtil");
// const thumbnailDb = require("../models/thumbnailDb");
const _ = require('underscore');

// get to get all
// http://localhost:8080/api/exhentaiApi
router.get('/api/exhentaiApi', serverUtil.asyncWrapper(async (req, res) => {
    console.time("[/api/exhentaiApi]")
    try{
        let sql = `SELECT fileName FROM zip_view `;
        let tempAllFiles = await db.doSmartAllSync(sql);

        // 从thumbnail拿一点数据
        sql = `SELECT filePath FROM thumbnail_table ORDER BY ROWID DESC LIMIT  1000`;
        let tempAllFiles2 = await db.doSmartAllSync(sql);
        tempAllFiles2.forEach(row => {
            row.fileName = path.basename(row.filePath);
        })


        const allFiles = _.uniq([...tempAllFiles, ...tempAllFiles2]);

        const result = [];
        allFiles.forEach(row => {
            const fileName = row.fileName;
            let pObj = serverUtil.parse(fileName);
            if (pObj) {
                const key = path.basename(fileName, path.extname(fileName)).trim();
                result.push([key, pObj.title, pObj.author]);
            }
        })
    
        res.setHeader('Cache-Control', 'public, max-age=120');
        res.send({
            allFiles: result
        });
    }catch(e){
        console.error("[/api/exhentaiApi]", e);
    }

    console.timeEnd("[/api/exhentaiApi]")
}));

module.exports = router;
