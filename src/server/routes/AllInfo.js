
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
    //GROUP_CONCAT(filePath, ' || ')
    let sql = `SELECT authors, COUNT(authors) as count, filePath  FROM file_table ` +
              `GROUP BY authors HAVING isCompress = true ORDER BY count DESC`;
    let author_rows = await sqldb.allSync(sql);
    author_rows.forEach(row => {
        row.thumbnail = getThumbnails(row.filePath)
    })


    sql = `SELECT tags, COUNT(tags) as count, filePath FROM file_table ` +
           `GROUP BY tags HAVING isCompress = true ORDER BY count DESC`;
    let tag_rows = await sqldb.allSync(sql);
    tag_rows.forEach(row => {
        row.thumbnail = getThumbnails(row.filePath)
    })


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
