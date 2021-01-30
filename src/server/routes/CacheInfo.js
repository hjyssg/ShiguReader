
const express = require('express');
const router = express.Router();
// const db = require("../models/db");
const util = global.requireUtil();
const { isDisplayableInOnebook } = util;
const thumbnailDb = require("../models/thumbnailDb");
const cacheDb = require("../models/cacheDb");

router.post('/api/cacheInfo', async (req, res) => {
    const cacheFileToInfo = cacheDb.getCacheFileToInfo();
    const cacheFiles = cacheDb.getAllCacheFilePathes().filter(isDisplayableInOnebook);
    let totalSize = 0;

    cacheFiles.forEach(e => {
        if(cacheFileToInfo[e]){
            totalSize +=  cacheFileToInfo[e].size;
        }
    })
    const thumbCount = await thumbnailDb.getThumbCount();
    res.send({
        thumbCount,
        totalSize: totalSize,
        cacheNum: cacheFiles.length
    })
});

module.exports = router;
