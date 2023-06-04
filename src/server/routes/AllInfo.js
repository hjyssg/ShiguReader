
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const util = global.requireUtil();
// const { isDisplayableInExplorer } = util;
const nameParser = require('../../name-parser');
const logger = require("../logger");


async function add_col(rows){
    const thumbnails = await serverUtil.common.getThumbnailsForZip(rows.map(e => e.filePath))
    for (let ii = 0; ii < rows.length; ii++) {
        const row = rows[ii];
        row.thumbnail = thumbnails[row.filePath];
    }
}

function getSql(tableName){
    // 只管zip文件，image folder太麻烦，不管了。  
    // 每个tag，统计数量。已经找到最新的一本zip，之后用来找thumbnail。
    return `SELECT a.filePath, MAX(a.mTime) AS maxTime, b.tag, COUNT(b.tag) AS count, b.type, b.subtype
    FROM file_table a 
    INNER JOIN ${tableName} b ON a.filePath = b.filePath 
    GROUP BY b.tag 
    HAVING a.mTime = maxTime AND count > 1 
    ORDER BY count DESC;`
}

router.post('/api/get_authors', serverUtil.asyncWrapper(async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    let sql = getSql("author_view");
    let author_rows = await db.doSmartAllSync(sql);
    await add_col(author_rows);

    res.send({
        author_rows
    });
}));

router.post('/api/get_tags', serverUtil.asyncWrapper(async (req, res) => {
    // const needThumbnail = req.body && req.body.needThumbnail;
    let sql = getSql("tag_view");
    let tag_rows = await db.doSmartAllSync(sql);
    await add_col(tag_rows);

    res.send({
        tag_rows
    });
}));

//直接把tag结果传给前端，提高性能。失败也不影响使用
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
    // logger.debug(logLabel, size, "  ", timeUsed, "ms")
}));

router.post('/api/allInfo', serverUtil.asyncWrapper(async (req, res) => {
    let sql = `SELECT *  FROM file_table WHERE isDisplayableInExplorer=1 `;
    let rows = await db.doSmartAllSync(sql);
    const fileToInfo = serverUtil.convertFileRowsIntoFileInfo(rows);

    res.send({
        fileToInfo: fileToInfo,
    });
}));

module.exports = router;
