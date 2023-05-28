

const express = require('express');
const router = express.Router();
const db = require("../models/db");
// const util = global.requireUtil();
// const { isCompress } = util;
// const userConfig = global.requireUserConfig();
const serverUtil = require("../serverUtil");
// const memorycache = require('memory-cache');


async function getGoodAndOtherSet() {
    // let beg = (new Date).getTime();
    let sql;
    let authorInfo = [];
    let tagInfo = [];
    const sqldb = db.getSQLDB();
    // const cacheKey = "GoodAndOtherSetCacheKey";
    // if(memorycache.get(cacheKey)){
    //     authorInfo = memorycache.get(cacheKey);
    // memorycache.put(cacheKey, authorInfo, 10*1000);
  

    if (global.good_folder_root && global.not_good_folder_root) {
        sql = `SELECT tag, 
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
                COUNT(filePath) AS total_count
                FROM author_view GROUP BY tag`;
        authorInfo = await sqldb.allSync(sql, [global.good_folder_root, global.not_good_folder_root]);
        authorInfo.forEach(row => {
            row.score = serverUtil.getScoreFromCount(row);
        });

        sql = `SELECT tag, 
        COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
        COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
        COUNT(filePath) AS total_count
        FROM tag_view GROUP BY tag`;
        tagInfo = await sqldb.allSync(sql, [global.good_folder_root, global.not_good_folder_root]);
        tagInfo.forEach(row => {
            row.score = serverUtil.getScoreFromCount(row);
        });
    }

    // let end = (new Date).getTime();
    // console.log(`[/api/getGoodAuthorNames] ${(end - beg) / 1000}s`);
    return {
        authorInfo,
        tagInfo
    }
}

router.get('/api/getGoodAuthorNames', serverUtil.asyncWrapper(async (req, res) => {
    const result = await getGoodAndOtherSet();
    res.setHeader('Cache-Control', 'public, max-age=20');
    res.send(result);
}));

module.exports = router;
