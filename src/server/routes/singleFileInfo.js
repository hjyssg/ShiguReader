
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const db = require("../models/db");
const pfs = require('promise-fs');

router.post("/api/singleFileInfo", async (req, res) => {
    const filePath = (req.body && req.body.filePath);

    if (!filePath || !(await isExist(filePath))) {
        res.sendStatus(404);
        return;
    }

    let stat =  db.getFileToInfo()[filePath];
    if(!stat){
        stat = await pfs.stat(filePath);
    }

    res.send({
        stat
    });
});

module.exports = router;
