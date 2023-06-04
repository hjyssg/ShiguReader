
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
const util = global.requireUtil();
const path = require('path');
const historyDb = require("../models/historyDb");
const serverUtil = require("../serverUtil");


router.post('/api/getHistoryForOneFile', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const fileName = path.basename(filePath);
    const history = await historyDb.getHistoryForOneFile(fileName);
    res.send({
        history
    })
}));

router.post('/api/getHistoryPageData', serverUtil.asyncWrapper(async (req, res) => {
    let page = req.body && req.body.page;
    page = parseInt(page);
    const history = await historyDb.getHistoryPageData(page);
    res.send(history);
}));

router.post("/api/getFileHistory", serverUtil.asyncWrapper(async (req, res) => {
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
