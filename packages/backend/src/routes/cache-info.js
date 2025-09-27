
const express = require('express');
const router = express.Router();
// const db = require("../models/db");
// const util = global.requireUtil();
// const { isDisplayableInOnebook } = util;
const thumbnailDb = require("../models/thumbnail-db");
const cacheDb = require("../models/cache-db");
const serverUtil = require("../utils/server-util");
const _  = require("underscore");


router.post('/api/cache/get_info', serverUtil.asyncWrapper(async (req, res) => {
    const cacheFileToInfo = cacheDb.getCacheFileToInfo();
    const cacheFiles = _.keys(cacheFileToInfo);
    let totalSize = 0;

    cacheFiles.forEach(e => {
        if(cacheFileToInfo[e]){
            totalSize +=  (cacheFileToInfo[e].size||0);
        }
    })
    const thumbCount = await thumbnailDb.getThumbCount();
    res.send({
        thumbCount,
        totalSize: totalSize,
        cacheNum: cacheFiles.length
    })
}));

module.exports = router;
