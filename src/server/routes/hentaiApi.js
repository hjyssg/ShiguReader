
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const util = require("../../util");
const { isCompress, isMusic, isVideo, arraySlice, getCurrentTime } = util;
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
