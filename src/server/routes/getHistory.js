
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
// const util = global.requireUtil();
const path = require('path');
const historyDb = require("../models/historyDb");
const serverUtil = require("../serverUtil");


router.post('/api/getHistoryByFP', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const fileName = path.basename(filePath);
    const history = await historyDb.getHistoryByFP(fileName);
    res.send({
        history
    })
}));

router.post('/api/getHistory', serverUtil.asyncWrapper(async (req, res) => {
    let page = req.body && req.body.page;
    page = parseInt(page);
    const history = await historyDb.getHistory(page);
    res.send(history);
}));
module.exports = router;
