

const express = require('express');
const router = express.Router();
const db = require("../models/db");
const util = global.requireUtil();
// const { isCompress } = util;
// const userConfig = global.requireUserConfig();
// const serverUtil = require("../serverUtil");

async function getGoodAndOtherSet() {
    let beg = (new Date).getTime();
    let sql;
    let authorInfo = [];
    const sqldb = db.getSQLDB();

    if(global.good_folder_root){
        //conditional count
        sql = `SELECT tag, ` + 
        `COUNT(CASE WHEN INSTR(filePath, ?) = 1 THEN 1 END) AS good_count, ` + 
        `COUNT(CASE WHEN INSTR(filePath, ?) != 1 THEN 1 END) AS bad_count ` + 
        `FROM tag_table WHERE type = 'author' GROUP BY tag`;
        authorInfo = await sqldb.allSync(sql, [global.good_folder_root, global.good_folder_root]);
    }

    // let end = (new Date).getTime();
    // console.log(`[/api/getGoodAuthorNames] ${(end - beg) / 1000}s`);
    return {
        authorInfo
    }
}

router.post('/api/getGoodAuthorNames', async (req, res) => {
    const result = await getGoodAndOtherSet();
    res.send(result);
});

module.exports = router;
