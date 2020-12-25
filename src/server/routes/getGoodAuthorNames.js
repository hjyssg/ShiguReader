

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

    // const sep = serverUtil.sep;

    // const reg = global.good_folder_root && escapeRegExp(global.good_folder_root);

    //todo sql groupby

    // getFileCollection()
    //     .chain()
    //     .find({ isDisplayableInExplorer: true })
    //     .where(obj => {
    //         // const temp = serverUtil.parse(p);
    //         // const name = temp && temp.author;
    //         const authors = obj.authors.split(sep);
    //         const name = authors[0];
    //         if (name) {
    //             if (reg && obj.filePath.match(reg)) {
    //                 set[name] = set[name] ? set[name] + 1 : 1;
    //             } else {
    //                 otherSet[name] = otherSet[name] ? otherSet[name] + 1 : 1;
    //             }
    //         }
    //         return false;
    //     });

    // let end2 = (new Date).getTime();
    // console.log(`${(end2 - beg)/1000}s to getGoodAndOtherSet`);

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
