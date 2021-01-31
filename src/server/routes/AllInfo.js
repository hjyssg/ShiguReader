
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getThumbnailsForZip } = serverUtil.common;
const util = global.requireUtil();
const { isDisplayableInExplorer } = util;

router.post('/api/tagInfo', async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();

    // let sql1 = `SELECT * FROM tag_table WHERE type = 'author'`
    // let author_list = await sqldb.allSync(sql1);

    // sql1 = `SELECT * FROM file_table where isCompress = true`
    // author_list = await sqldb.allSync(sql1);

    let sql = `SELECT a.filePath, max(a.sTime) as maxTime , b.tag, COUNT(b.tag) as count, b.type, b.subtype `
        + `FROM (SELECT * FROM tag_table WHERE type = 'author' and isCompress = true) AS b LEFT JOIN `
        + `(SELECT * FROM file_table where isCompress = true ) AS a `
        + `ON a.filePath = b.filePath `
        + `GROUP BY tag HAVING a.sTime = maxTime AND count > 1 ORDER BY count DESC`;

    //todo: sort by  a.sTime DESC
    let author_rows = await sqldb.allSync(sql);

    sql = `SELECT a.filePath, max(a.sTime) as maxTime , b.tag, COUNT(b.tag) as count, b.type, b.subtype `
        + `FROM (SELECT * FROM tag_table WHERE type = 'tag' and isCompress = true) AS b LEFT JOIN `
        + `(SELECT * FROM file_table where isCompress = true) AS a `
        + `ON a.filePath = b.filePath `
        + ` GROUP BY tag HAVING a.sTime = maxTime AND count > 1 ORDER BY count DESC`;
    let tag_rows = await sqldb.allSync(sql);
    const allRows = [].concat(author_rows, tag_rows);

    const thumbnails = await getThumbnailsForZip(allRows.map(e => e.filePath))
    for (let ii = 0; ii < allRows.length; ii++) {
        const row = allRows[ii];
        row.thumbnail = thumbnails[row.filePath];
    }

    res.send({
        author_rows,
        tag_rows
    });
});

router.post('/api/allInfo', async (req, res) => {
    const needThumbnail = req.body && req.body.needThumbnail;

    let allThumbnails = {};
    const files = db.getAllFilePathes().filter(isDisplayableInExplorer);
    if (needThumbnail) {
        allThumbnails = await getThumbnailsForZip(files);
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
