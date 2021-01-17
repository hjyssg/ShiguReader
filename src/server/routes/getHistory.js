
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");

const util = global.requireUtil();
const isWindows = require('is-windows');
const historyDB = require("../models/historyDB");


router.post('/api/getHistory', async function (req, res) {
    const history = await historyDB.getHistory();
    res.send({
        history
    })
});
module.exports = router;
