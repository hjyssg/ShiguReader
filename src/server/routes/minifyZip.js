
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const getAllFilePathes = db.getAllFilePathes;
const path = require('path');
const getCacheOutputPath = db.getCacheOutputPath;
const cachePath = serverUtil.common.cachePath;
const  imageMagickHelp = require("../imageMagickHelp");


router.post('/api/minifyZip', (req, res) => {
    const filePath = req.body && req.body.filePath;
    imageMagickHelp(filePath);
});

module.exports = router;
