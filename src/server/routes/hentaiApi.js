
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const { getAllFilePathes } = db;
const util = global.requireUtil();
const { isCompress } = util;
const path = require('path');

// http://localhost:8080/api/exhentaiApi
router.get('/api/exhentaiApi', function (req, res) {
    let allfiles = getAllFilePathes().filter(isCompress);
    allfiles = allfiles.map(e => {
        return path.basename(e, path.extname(e)).trim();
    });

    res.send({
        allFiles: allfiles
    }); 
})

module.exports = router;
