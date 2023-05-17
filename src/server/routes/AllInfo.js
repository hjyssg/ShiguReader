
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getThumbnailsForZip } = serverUtil.common;
const util = global.requireUtil();
const { isDisplayableInExplorer } = util;
const nameParser = require('../../name-parser');

async function add_col(rows){
    const thumbnails = await getThumbnailsForZip(rows.map(e => e.filePath))
    for (let ii = 0; ii < rows.length; ii++) {
        const row = rows[ii];
        row.thumbnail = thumbnails[row.filePath];
    }
}

function getSql(tableName){
    // 只管zip文件，image folder太麻烦，不管了。  
    return `SELECT a.filePath, MAX(a.sTime) AS maxTime, b.tag, COUNT(b.tag) AS count, b.type, b.subtype
    FROM zip_view a 
    INNER JOIN ${tableName} b ON a.filePath = b.filePath 
    GROUP BY b.tag 
    HAVING a.sTime = maxTime AND count > 1 
    ORDER BY count DESC;`
}

router.post('/api/get_authors', serverUtil.asyncWrapper(async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();
    let sql = getSql("author_view");
    let author_rows = await sqldb.allSync(sql);
    await add_col(author_rows);

    res.send({
        author_rows
    });
}));

router.post('/api/get_tags', serverUtil.asyncWrapper(async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    const sqldb = db.getSQLDB();
    let sql = getSql("tag_view");
    let tag_rows = await sqldb.allSync(sql);
    await add_col(tag_rows);

    res.send({
        tag_rows
    });
}));

router.get('/api/getParseCache/', serverUtil.asyncWrapper(async (req, res) => {
    const logLabel = '[/api/getParseCache/]';
    const time1 = util.getCurrentTime();

    const localCache = nameParser.getLocalCache();
    const size = Object.keys(localCache).length;
    if(size > 5000){
        res.setHeader('Cache-Control', 'public, max-age=600');
    }
    res.send(localCache); 

    const time2 = util.getCurrentTime();
    const timeUsed = (time2 - time1);
    console.log(logLabel, size, "  ", timeUsed, "ms")
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
