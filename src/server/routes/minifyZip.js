
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const path = require('path');
const getCacheOutputPath = db.getCacheOutputPath;
const cachePath = serverUtil.common.cachePath;
const  imageMagickHelp = require("../imageMagickHelp");

const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;

// const pLimit = require('p-limit');
// const extractlimit = pLimit(1);

//use a queue for mulitple tasks

const minifyZipQue = [];
router.post('/api/minifyZipQue', (req, res) => {

    res.send({
        minifyZipQue
    })
})

const pLimit = require('p-limit');
const limit = pLimit(1);

router.post('/api/minifyZip', async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath)) || minifyZipQue.includes(filePath)  ) {
        res.sendStatus(404);
    }

    minifyZipQue.push(filePath);
    await limit(() => imageMagickHelp.minifyOneFile(filePath));
    minifyZipQue.shift();

    res.sendStatus(200);
});

module.exports = router;
