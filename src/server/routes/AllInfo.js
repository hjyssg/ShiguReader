
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getAllFilePathes } = db;
const getThumbnails = serverUtil.common.getThumbnails;
const util = global.requireUtil();
const { isDisplayableInExplorer } = util;

router.post('/api/tagInfo', async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();

    //inner joiner then group by
    let sql = `SELECT a.filePath, max(a.sTime) as maxTime , b.tag, COUNT(b.tag) as count, b.type ` 
    + `FROM file_table AS a INNER JOIN tag_table AS b `
    + `ON a.filePath = b.filePath AND a.isCompress = true GROUP BY tag HAVING a.sTime = maxTime ORDER BY count DESC`;

    //todo: sort by  a.sTime DESC
    let rows = await sqldb.allSync(sql);

    rows.forEach(row => {
        row.thumbnail = getThumbnails(row.filePath)
    })

    const author_rows = rows.filter(row => row.type === "author");
    const tag_rows = rows.filter(row => row.type === "tag");

    res.send({
        author_rows, 
        tag_rows
    });
});

router.post('/api/allInfo', async (req, res) => {
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
