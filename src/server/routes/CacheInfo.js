
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const util = global.requireUtil();
const { isDisplayableInOnebook, isCompressedThumbnail } = util;

router.get('/api/cacheInfo', (req, res) => {
    const cacheFileToInfo = db.getCacheFileToInfo();
    const cacheFiles =  db.getAllCacheFilePathes().filter(isDisplayableInOnebook);
    let totalSize = 0;

    const thumbnailNum = cacheFiles.filter(isCompressedThumbnail).length;

    cacheFiles.forEach(e => {
        totalSize += cacheFileToInfo[e].size;
    })

    res.send({
        totalSize: totalSize,
        thumbnailNum,
        cacheNum: cacheFiles.length
    })
});

module.exports = router;
