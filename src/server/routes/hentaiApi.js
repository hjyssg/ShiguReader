
const path = require('path');
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const util = global.requireUtil();
const { isCompress } = util;
const zipInfoDb = require("../models/zipInfoDb");
const serverUtil = require("../serverUtil");

// get to get all
// http://localhost:8080/api/exhentaiApi
router.get('/api/exhentaiApi', async (req, res) => {
    console.time("[/api/exhentaiApi]")
    let allFiles = db.getAllFilePathes().filter(isCompress);
    const zipInfo = zipInfoDb.getZipInfo(allFiles);

    const result = {};
    allFiles.forEach(fp => {
        const key = path.basename(fp, path.extname(fp)).trim();
        result[key] = Object.assign({}, zipInfo[fp]);
        let pObj = serverUtil.parse(key);
        if (pObj) {
            result[key].title = pObj.title;
            result[key].author = pObj.author;
        }
    })

    res.setHeader('Cache-Control', 'public, max-age=120');
    res.send({
        allFiles: result
    });
    console.timeEnd("[/api/exhentaiApi]")
})

module.exports = router;
