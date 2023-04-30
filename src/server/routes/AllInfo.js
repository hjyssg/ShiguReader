
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getThumbnailsForZip } = serverUtil.common;
const util = global.requireUtil();
const { isDisplayableInExplorer } = util;

async function add_col(rows){
    const thumbnails = await getThumbnailsForZip(rows.map(e => e.filePath))
    for (let ii = 0; ii < rows.length; ii++) {
        const row = rows[ii];
        row.thumbnail = thumbnails[row.filePath];
    }
}

router.post('/api/get_authors', async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();

    // let sql = `SELECT a.filePath, max(a.sTime) as maxTime , b.tag, COUNT(b.tag) as count, b.type, b.subtype
    //     FROM (SELECT * FROM tag_table WHERE type = 'author' and isCompress = true) AS b LEFT JOIN
    //     (SELECT * FROM file_table where isCompress = true ) AS a
    //     ON a.filePath = b.filePath
    //     GROUP BY tag HAVING a.sTime = maxTime AND count > 1 ORDER BY count DESC`;
    let sql = `SELECT a.filePath, MAX(a.sTime) AS maxTime, b.tag, COUNT(b.tag) AS count, b.type, b.subtype
    FROM file_table a 
    LEFT JOIN tag_table b ON a.filePath = b.filePath 
    WHERE b.type = 'author' AND a.isCompress = 1 AND b.isCompress = 1 
    GROUP BY b.tag 
    HAVING a.sTime = maxTime AND count > 1 
    ORDER BY count DESC;`

    let author_rows = await sqldb.allSync(sql);
    await add_col(author_rows);

    res.send({
        author_rows
    });
});

router.post('/api/get_tags', async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();

    // sql = `SELECT a.filePath, max(a.sTime) as maxTime , b.tag, COUNT(b.tag) as count, b.type, b.subtype
    //         FROM (SELECT * FROM tag_table WHERE type = 'tag' and isCompress = true) AS b LEFT JOIN
    //         (SELECT * FROM file_table where isCompress = true) AS a
    //         ON a.filePath = b.filePath
    //         GROUP BY tag HAVING a.sTime = maxTime AND count > 1 ORDER BY count DESC`;

    sql = `
    SELECT a.filePath, MAX(a.sTime) AS maxTime, b.tag, COUNT(b.tag) AS count, b.type, b.subtype
    FROM file_table a 
    LEFT JOIN tag_table b ON a.filePath = b.filePath 
    WHERE b.type = 'tag' AND a.isCompress = 1 AND b.isCompress = 1 
    GROUP BY b.tag 
    HAVING a.sTime = maxTime AND count > 1 
    ORDER BY count DESC;
    `
    let tag_rows = await sqldb.allSync(sql);

    await add_col(tag_rows);

    res.send({
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
