
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const path = require('path');
const getCacheOutputPath = db.getCacheOutputPath;
const cachePath = serverUtil.common.cachePath;

router.get('/api/cacheInfo', (req, res) => {
    const cacheFiles =  _.keys(cacheDb.cacheFileToInfo).filter(isDisplayableInOnebook);
    let totalSize = 0;

    const thumbnailNum = cacheFiles.filter(util.isCompressedThumbnail).length;

    cacheFiles.forEach(e => {
        totalSize += cacheDb.cacheFileToInfo[e].size;
    })

    res.send({
        totalSize: totalSize,
        thumbnailNum,
        cacheNum: cacheFiles.length
    })
});

module.exports = router;
