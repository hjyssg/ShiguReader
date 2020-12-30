

const express = require('express');
const router = express.Router();
const db = require("../models/db");
const util = global.requireUtil();
const { isCompress, escapeRegExp } = util;
const userConfig = global.requireUserConfig();
const serverUtil = require("../serverUtil");

async function getGoodAndOtherSet() {
    let beg = (new Date).getTime();

    const sqldb = db.getSQLDB();


    let sql,otherAuthors;

    //for debug
    let temp;
    // sql = `SELECT * FROM file_table WHERE filePath LIKE ? AND isCompress = true `
    // temp = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);

    // sql = `SELECT * FROM file_table WHERE filePath NOT LIKE ? AND isCompress = true `
    // temp = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);

    // sql = `SELECT * FROM tag_table WHERE type = 'author'`
    // temp = await sqldb.allSync(sql);

    //conditional count
    sql = `SELECT tag, ` + 
    `COUNT(CASE WHEN filePath LIKE ? THEN 1 END) AS good_count, ` + 
    `COUNT(CASE WHEN filePath NOT LIKE ? THEN 1 END) AS bad_count ` + 
    `FROM tag_table GROUP BY tag HAVING type = 'author'`
    authorInfo = await sqldb.allSync(sql, [( global.good_folder_root + '%'), ( global.good_folder_root + '%')]);


    // JOIN 难用死了，把自己绕进去了
    // //join two sub querys then group
    // sql = `SELECT a.tag, COUNT(a.tag) as count, a.filePath ` 
    // + `FROM (SELECT * FROM tag_table WHERE type = 'author') AS a JOIN `
    // + `(SELECT * FROM file_table WHERE filePath LIKE ? AND isCompress = true ) AS b `
    // + `ON a.filePath = b.filePath GROUP BY a.tag `;
    // goodAuthors = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);

    // //the only different is NOT LIKE
    // sql = `SELECT a.tag, COUNT(a.tag) as count ` 
    // + `FROM (SELECT * FROM tag_table WHERE type = 'author') AS a JOIN `
    // + `(SELECT * FROM file_table WHERE filePath NOT LIKE ? AND isCompress = true ) AS b `
    // + `ON a.filePath = b.filePath GROUP BY a.tag `;
    // otherAuthors = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);;

    return {
        authorInfo
    }
}

router.post('/api/getGoodAuthorNames', async (req, res) => {
    const result = await getGoodAndOtherSet();
    res.send(result);
});

module.exports = router;
