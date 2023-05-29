
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
const util = global.requireUtil();
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

router.post("/api/getFileHistory", serverUtil.asyncWrapper(async (req, res) => {
    const all_pathes = req.body && req.body.all_pathes;
    if (!all_pathes) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    try{
        //需要拆分成好几个小array
        const fileHistory = [];
        const subs = util.cutIntoSmallArrays(all_pathes);
        for(const sub of subs){
            const temp = await historyDb.getFileHistory(sub);
            fileHistory.push(...temp);
        }

        // assert
        const subLength = subs.map(e => e.length).reduce(function(a, b) { return a + b; }, 0);
        console.assert(subLength === all_pathes.length);

        // const fileHistory = await historyDb.getFileHistory(all_pathes);
        res.send({ failed: false, fileHistory });
    }catch(e){
        res.send({failed: true})
    }
}));

module.exports = router;
