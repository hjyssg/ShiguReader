
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
    let sql = `SELECT a.filePath, b.tag, COUNT(b.tag) as count, b.type` 
    + `FROM file_table AS a INNER JOIN tag_table AS b `
    + `ON a.filePath = b.filePath  GROUP BY tag ORDER BY count DESC`;
    let rows = await sqldb.allSync(sql2);

    rows.forEach(row => {
        row.thumbnail = getThumbnails(row.filePath)
    })

    const author_rows = row.filter(row => row.type === "author");
    const tag_rows = row.filter(row => row.type === "tag");

    res.send({
        author_rows, 
        tag_rows
    });
});

router.post('/api/allInfo', async (req, res) => {
    const needThumbnail = req.body && req.body.needThumbnail;

    const sqldb = db.getSQLDB();
    let sql = `SELECT authors, COUNT(authors) as count, GROUP_CONCAT(filePath, ' || ') as filePathArr FROM file_table GROUP BY authors ORDER BY count DESC`;
    let rows = await sqldb.allSync(sql);


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
