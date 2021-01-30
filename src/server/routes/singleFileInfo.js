
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const serverUtil = require("../serverUtil");
const { getStat } = serverUtil.common;
const historyDb = require("../models/historyDb");
const util = global.requireUtil();
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;

router.post("/api/singleFileInfo", async (req, res) => {
    const filePath = (req.body && req.body.filePath);

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    let stat = db.getFileToInfo(filePath);
    if (!stat) {
        stat = await getStat(filePath);
    }

    const mecab_tokens = await global.mecab_getTokens(filePath);

    res.send({
        stat,
        mecab_tokens
    });

    if (util.isVideo(filePath)) {
        historyDb.addOneRecord(filePath);
    }
});

module.exports = router;

