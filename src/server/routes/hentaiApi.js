
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const { getAllFilePathes } = db;
const util = global.requireUtil();
const { isCompress } = util;
const path = require('path');

// http://localhost:8080/api/exhentaiApi
router.get('/api/exhentaiApi', function (req, res) {
    let allFiles = getAllFilePathes().filter(isCompress);
    allFiles = allFiles.map(e => {
        return path.basename(e, path.extname(e)).trim();
    });

    const zipInfoDb = require("../models/zipInfoDb");
    const { getZipInfo }  = zipInfoDb;
    const fileInfo = getZipInfo(allFiles);

    allFiles.forEach(e => {
        if(fileInfo[e]){
            fileInfo[e] = { pageNum: fileInfo[e].pageNum};
        }else{
            fileInfo[e] = { pageNum: "unknown"};
        }
    })

    res.send({
        allFiles: fileInfo
    }); 
})

module.exports = router;
