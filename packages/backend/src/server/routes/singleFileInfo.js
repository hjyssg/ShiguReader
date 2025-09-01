
const express = require('express');
const router = express.Router();
// const db = require("../models/db");
const serverUtil = require("../serverUtil");
const historyDb = require("../models/historyDB");
const util = global.requireUtil();
const pathUtil = require("../pathUtil");
const pfs = require('promise-fs');
const { isExist } = pathUtil;

router.post("/api/singleFileInfo", serverUtil.asyncWrapper(async (req, res) => {
    const filePath = (req.body && req.body.filePath);

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }


    const stat = await pfs.stat(filePath);
    const mecab_tokens = [];
    res.send({
        stat,
        mecab_tokens
    });

    if (util.isVideo(filePath)) {
        historyDb.addOneRecord(filePath);
    }
}));

module.exports = router;

