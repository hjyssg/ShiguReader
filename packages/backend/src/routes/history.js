
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
const util = require('../common/util');
const path = require('path');
const historyDb = require("../models/history-db");
const serverUtil = require("../utils/server-util");


router.post('/api/history/get_one_file', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const fileName = path.basename(filePath);
    const history = await historyDb.getHistoryForOneFile(fileName);
    res.send({
        history
    })
}));

router.post('/api/history/list', serverUtil.asyncWrapper(async (req, res) => {
    let page = req.body && req.body.page;
    page = parseInt(page);
    const history = await historyDb.getHistoryPageData(page);
    res.send(history);
}));

router.post('/api/history/add', serverUtil.asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;
    if (!filePath) {
        res.send({ failed: true, reason: "No parameter" });
        return;
    }

    try {
        const now = util.getCurrentTime();
        const inserted = await historyDb.addOneRecord(filePath, now);
        if (!inserted) {
            res.send({ failed: false, skipped: true });
            return;
        }

        res.send({ failed: false });
    } catch (err) {
        res.send({ failed: true, reason: err?.message || String(err) });
    }
}));

router.post("/api/history/get_file_history", serverUtil.asyncWrapper(async (req, res) => {
    const all_pathes = req.body && req.body.all_pathes;
    if (!all_pathes) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    try{
        const fileHistory = await historyDb.getBatchFileHistory(all_pathes);
        res.send({ failed: false, fileHistory });
    }catch(e){
        res.send({failed: true})
    }
}));

module.exports = router;
