
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getAllFilePathes } = db;
const getThumbnails = serverUtil.common.getThumbnails;
const util = global.requireUtil();
const { isDisplayableInExplorer } = util;

    // sqldb.all(`SELECT DISTINCT authors FROM file_table  ORDER BY authors`, [], (err, rows) => {
    //     if (err) {
    //       throw err;
    //     }
    //     rows.forEach((row) => {
    //       console.log(row.authors);
    //     });
    //   })

router.post('/api/allInfo', (req, res) => {
    const needThumbnail = req.body && req.body.needThumbnail;

    let allThumbnails = {};
    const files = getAllFilePathes().filter(isDisplayableInExplorer);
    if (needThumbnail) {
        allThumbnails = getThumbnails(files);
    }

    const fileToInfo = {};
    files.forEach(e => {
        fileToInfo[e] = db.getFileToInfo(e);
    })

    res.send({
        fileToInfo: fileToInfo,
        allThumbnails: allThumbnails
    });
});

module.exports = router;
