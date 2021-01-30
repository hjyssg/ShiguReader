
const express = require('express');
const router = express.Router();
// const serverUtil = require("../serverUtil");
// const util = global.requireUtil();
const historyDb = require("../models/historyDb");


router.post('/api/getHistory', async (req, res) => {
    const history = await historyDb.getHistory();
    res.send({
        history
    })
});
module.exports = router;
