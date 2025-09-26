

const express = require('express');
const router = express.Router();
const db = require("../models/db");
// const util = global.requireUtil();
// const { isCompress } = util;
// const userConfig = global.requireUserConfig();
const serverUtil = require("../utils/server-util");


async function getGoodAndOtherSet() {
    // let beg = (new Date).getTime();
    let sql;
    let authorInfo = [];
    let tagInfo = [];


    sql = `SELECT * FROM tag_table WHERE type='author'   `;
    authorInfo = await db.doSmartAllSync(sql, []);

    sql = ` SELECT * FROM tag_table WHERE type='tag'  `;
    tagInfo = await db.doSmartAllSync(sql, []);

    // let end = (new Date).getTime();
    // console.log(`[/api/getGoodAuthorNames] ${(end - beg) / 1000}s`);
    return {
        authorInfo,
        tagInfo
    }
}

router.get('/api/getGoodAuthorNames', serverUtil.asyncWrapper(async (req, res) => {
    const result = await getGoodAndOtherSet();
    // res.setHeader('Cache-Control', 'public, max-age=20');
    res.send(result);
}));

module.exports = router;
