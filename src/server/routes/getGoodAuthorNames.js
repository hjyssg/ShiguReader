

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

    //join two sub querys then group
    sql = `SELECT a.tag, COUNT(a.tag) as count ` 
    + `FROM (SELECT * FROM tag_table WHERE type = 'author') AS a LEFT JOIN `
    + `(SELECT * FROM file_table WHERE filePath LIKE ? AND isCompress = true ) AS b `
    + `ON a.filePath = b.filePath GROUP BY a.tag `;
    goodAuthors = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);

    //the only different is NOT LIKE
    sql = `SELECT a.tag, COUNT(a.tag) as count ` 
    + `FROM (SELECT * FROM tag_table WHERE type = 'author') AS a LEFT JOIN `
    + `(SELECT * FROM file_table WHERE filePath NOT LIKE ? AND isCompress = true ) AS b `
    + `ON a.filePath = b.filePath GROUP BY a.tag `;
    otherAuthors = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);;

    return {
        goodAuthors,
        otherAuthors
    }
}

router.post('/api/getGoodAuthorNames', async (req, res) => {
    const result = await getGoodAndOtherSet();
    res.send(result);
});

module.exports = router;
