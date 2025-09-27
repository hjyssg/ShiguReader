
const express = require('express');
const router = express.Router();
// const db = require("../models/db");
// const util = global.requireUtil();
// const { isDisplayableInOnebook } = util;
const thumbnailDb = require("../models/thumbnail-db");
const cacheDb = require("../models/cache-db");
const serverUtil = require("../utils/server-util");
const _  = require("underscore");
const appState = require('../state/appState');
const cachePath = appState.getCachePath();
const deleteEmpty = require('delete-empty');
const pathUtil = require("../utils/path-util");
const cleanCache = require("../services/cache-cleaner");

function doCacheClean(config) {
    try {
        cleanCache(cachePath, config);
    } catch (e) {
        console.error(e);
    }
}


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

router.post('/api/cleanCache', serverUtil.asyncWrapper(async (req, res) => {
    function afterClean() {
        res.send({ failed: false });
    }

    doCacheClean({ afterClean });

    //delete empty folder
    deleteEmpty(pathUtil.getImgConverterCachePath(), (err) => {
        if (err) {
            console.error(err);
        }
    });
}));

module.exports = router;
