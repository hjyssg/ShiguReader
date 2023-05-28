

const express = require('express');
const router = express.Router();
const db = require("../models/db");
// const util = global.requireUtil();
// const { isCompress } = util;
// const userConfig = global.requireUserConfig();
const serverUtil = require("../serverUtil");
const memorycache = require('memory-cache');

async function getGoodAndOtherSet() {
    // let beg = (new Date).getTime();
    let sql;
    let authorInfo = [];
    const sqldb = db.getSQLDB();
    const cacheKey = "GoodAndOtherSetCacheKey";

    if (global.good_folder_root) {
        if(memorycache.get(cacheKey)){
            authorInfo = memorycache.get(cacheKey);
        }else{
             //conditional count
             // TODO：不好不坏咋办
            sql = `SELECT tag, 
                    COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
                    COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
                    COUNT(filePath) AS total_count
                    FROM author_view GROUP BY tag`;
            authorInfo = await sqldb.allSync(sql, [global.good_folder_root, global.not_good_folder_root]);
            memorycache.put(cacheKey, authorInfo, 10*1000);
        }
    }

    // let end = (new Date).getTime();
    // console.log(`[/api/getGoodAuthorNames] ${(end - beg) / 1000}s`);
    return {
        authorInfo
    }
}

router.post('/api/getGoodAuthorNames', serverUtil.asyncWrapper(async (req, res) => {
    const result = await getGoodAndOtherSet();
    res.send(result);
}));

module.exports = router;
