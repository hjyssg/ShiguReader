
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const util = global.requireUtil();
const { isCompress } = util;
const path = require('path');

// http://localhost:8080/api/exhentaiApi
router.get('/api/exhentaiApi', function (req, res) {
    let allFiles = db.getAllFilePathes().filter(isCompress);

    const zipInfoDb = require("../models/zipInfoDb");
    const zipInfo = zipInfoDb.getZipInfo(allFiles);

    const result = {};
    allFiles.forEach(e => {
        const key = path.basename(e, path.extname(e)).trim();
        result[key] = Object.assign({}, zipInfo[e]);
    })

    res.send({
        allFiles: result
    });
})

module.exports = router;
