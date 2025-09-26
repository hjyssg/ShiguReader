
const express = require('express');
const router = express.Router();
const serverUtil = require("../utils/server-util");
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
