

const express = require('express');
const router = express.Router();
const db = require("../models/db");
// const util = global.requireUtil();
// const { isCompress } = util;
// const userConfig = global.requireUserConfig();
const serverUtil = require("../serverUtil");
const scoreUtil = require("../scoreUtil");


function _addCol(rows){
    rows.forEach(row => {
        row.score = scoreUtil.getScoreFromCount(row);
    });
}

async function getGoodAndOtherSet() {
    // let beg = (new Date).getTime();
    let sql;
    let authorInfo = [];
    let tagInfo = [];

    // TODO 缓存到数据
    // 判断是否扫描了good_folder_root和not_good_folder_root
    // 没有就从数据库拿 isAlreadyScan
    if (global.good_folder_root && global.not_good_folder_root) {
        sql = `SELECT tag, MAX(subtype) AS subtype,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
                COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
                COUNT(filePath) AS total_count
                FROM author_view GROUP BY tag`;
        authorInfo = await db.doSmartAllSync(sql, [global.good_folder_root, global.not_good_folder_root]);
        _addCol(authorInfo);

        sql = `SELECT tag, MAX(subtype) AS subtype,
        COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count,
        COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS bad_count,
        COUNT(filePath) AS total_count
        FROM tag_view GROUP BY tag HAVING total_count >= 5 `;
        tagInfo = await db.doSmartAllSync(sql, [global.good_folder_root, global.not_good_folder_root]);
        _addCol(tagInfo);
    }else {

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
