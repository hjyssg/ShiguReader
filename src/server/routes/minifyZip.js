
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const path = require('path');
const getCacheOutputPath = db.getCacheOutputPath;
const cachePath = serverUtil.common.cachePath;
const  imageMagickHelp = require("../imageMagickHelp");

// const pLimit = require('p-limit');
// const extractlimit = pLimit(1);

//use a queue for mulitple tasks

const minifyZipQue = [];
router.post('/api/minifyZipQue', (req, res) => {

    res.send({
        minifyZipQue
    })
})

router.post('/api/minifyZip', async (req, res) => {
    const filePath = req.body && req.body.filePath;
    minifyZipQue.push(filePath);
    await imageMagickHelp.minifyOneFile(filePath);
    minifyZipQue.shift();
});

module.exports = router;
