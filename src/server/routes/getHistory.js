
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
// const util = global.requireUtil();
const path = require('path');
const historyDb = require("../models/historyDb");


router.post('/api/getHistoryByFP', async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const fileName = path.basename(filePath);
    const history = await historyDb.getHistoryByFP(fileName);
    res.send({
        history
    })
});

router.post('/api/getHistory', async (req, res) => {
    const history = await historyDb.getHistory();
    res.send({
        history
    })
});
module.exports = router;
