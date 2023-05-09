
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const cachePath = global.cachePath;
const deleteEmpty = require('delete-empty');
const pathUtil = require("../pathUtil");


function doCacheClean(config) {
    const cleanCache = require("../../tools/cleanCache");
    try {
        cleanCache.cleanCache(cachePath, config);
    } catch (e) {
        console.error(e);
    }
}

router.post('/api/cleanCache', serverUtil.asyncWrapper((req, res) => {
    function afterClean() {
        res.send({ failed: false });
    }

    doCacheClean({ afterClean });

    //delete empty folder
    deleteEmpty(pathUtil.getImgConverterCachePath(), (err, deleted) => {
        if (err) {
            console.error(err);
        }
    });
}));

module.exports = router;
