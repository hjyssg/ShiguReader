

const express = require('express');
const router = express.Router();
const db = require("../models/db");
const { getFileCollection } = db;
const util = global.requireUtil();
const { isCompress, escapeRegExp } = util;
const userConfig = global.requireUserConfig();
const serverUtil = require("../serverUtil");

function getGoodAndOtherSet() {
    let beg = (new Date).getTime();

    let set = {};
    let otherSet = {};
    const sep = serverUtil.sep;

    const reg = escapeRegExp(global.good_folder_root);

    getFileCollection()
        .chain()
        .find({ isDisplayableInExplorer: true })
        .where(obj => {
            // const temp = serverUtil.parse(p);
            // const name = temp && temp.author;
            const authors = obj.authors.split(sep);
            const name = authors[0];
            if (name) {
                if (obj.filePath.match(reg)) {
                    set[name] = set[name] ? set[name] + 1 : 1;
                } else {
                    otherSet[name] = otherSet[name] ? otherSet[name] + 1 : 1;
                }
            }
            return false;
        });

    let end2 = (new Date).getTime();
    // console.log(`${(end2 - beg)/1000}s to getGoodAndOtherSet`);

    return {
        set,
        otherSet
    }
}

router.post('/api/getGoodAuthorNames', async (req, res) => {
    const result = getGoodAndOtherSet();

    res.send({
        goodAuthors: result.set,
        otherAuthors: result.otherSet
    });
});

module.exports = router;
