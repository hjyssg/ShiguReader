
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

router.post('/api/get_authors', serverUtil.asyncWrapper(async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();

    let sql = `SELECT a.filePath, MAX(a.sTime) AS maxTime, b.tag, COUNT(b.tag) AS count, b.type, b.subtype
    FROM zip_view a 
    LEFT JOIN author_view b ON a.filePath = b.filePath 
    WHERE b.isCompress = 1 
    GROUP BY b.tag 
    HAVING a.sTime = maxTime AND count > 1 
    ORDER BY count DESC;`

    let author_rows = await sqldb.allSync(sql);
    await add_col(author_rows);

    res.send({
        author_rows
    });
}));

router.post('/api/get_tags', serverUtil.asyncWrapper(async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();
    sql = `
    SELECT a.filePath, MAX(a.sTime) AS maxTime, b.tag, COUNT(b.tag) AS count, b.type, b.subtype
    FROM zip_view a 
    LEFT JOIN tag_view b ON a.filePath = b.filePath 
    WHERE b.isCompress = 1 
    GROUP BY b.tag 
    HAVING a.sTime = maxTime AND count > 1 
    ORDER BY count DESC;
    `
    let tag_rows = await sqldb.allSync(sql);

    await add_col(tag_rows);

    res.send({
        tag_rows
    });
}));

router.post('/api/allInfo', serverUtil.asyncWrapper(async (req, res) => {
    const needThumbnail = req.body && req.body.needThumbnail;

    let allThumbnails = {};
    const files = await db.getAllFilePathes("WHERE isDisplayableInExplorer=1");
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
}));

module.exports = router;
