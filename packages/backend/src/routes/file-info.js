
const express = require('express');
const router = express.Router();
// const db = require("../models/db");
const serverUtil = require("../utils/server-util");
const historyDb = require("../models/history-db");
const util = require('../common/util');
const pathUtil = require("../utils/path-util");
const pfs = require('promise-fs');
const { isExist } = pathUtil;

router.post("/api/singleFileInfo", serverUtil.asyncWrapper(async (req, res) => {
    const filePath = (req.body && req.body.filePath);

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }


    const stat = await pfs.stat(filePath);
    res.send({
        stat,
    });

    if (util.isVideo(filePath)) {
        historyDb.addOneRecord(filePath);
    }
}));

module.exports = router;

