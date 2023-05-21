
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const cachePath = global.cachePath;
const deleteEmpty = require('delete-empty');
const pathUtil = require("../pathUtil");
const cleanCache = require("./cleanCache");

function doCacheClean(config) {
    try {
        cleanCache(cachePath, config);
    } catch (e) {
        console.error(e);
    }
}

router.post('/api/cleanCache', serverUtil.asyncWrapper(async (req, res) => {
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
