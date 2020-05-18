
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const serverUtil = require("../serverUtil");
const getStat = serverUtil.common.getStat;

router.post("/api/singleFileInfo", async (req, res) => {
    const filePath = (req.body && req.body.filePath);

    if (!filePath || !(await isExist(filePath))) {
        res.sendStatus(404);
        return;
    }

    let stat =  db.getFileToInfo(filePath);
    if(!stat){
        stat = await getStat(filePath);
    }

    res.send({
        stat
    });
});

module.exports = router;
