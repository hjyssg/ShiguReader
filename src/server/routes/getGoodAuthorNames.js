

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
    //inner joiner then group by
    let sql = `SELECT b.tag, COUNT(b.tag) as count ` 
    + `FROM (SELECT * FROM file_table WHERE filePath LIKE ? AND isCompress = true ) AS a INNER JOIN tag_table AS b `
    + `ON a.filePath = b.filePath GROUP BY b.tag HAVING b.type = 'author'`;
    let goodAuthors = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);

    //the only different is NOT LIKE
    sql = `SELECT b.tag, COUNT(b.tag) as count ` 
    + `FROM (SELECT * FROM file_table WHERE filePath NOT LIKE ? AND isCompress = true ) AS a INNER JOIN tag_table AS b `
    + `ON a.filePath = b.filePath GROUP BY b.tag HAVING b.type = 'author'`;
    let otherAuthors = await sqldb.allSync(sql, [( '%' + global.good_folder_root + '%')]);

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
