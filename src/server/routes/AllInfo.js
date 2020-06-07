
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getAllFilePathes } = db;
const getThumbnails = serverUtil.common.getThumbnails;

router.post('/api/allInfo', (req, res) => {
    const needThumbnail = req.body && req.body.needThumbnail;

    let allThumbnails = {};
    if(needThumbnail){
        allThumbnails = getThumbnails(getAllFilePathes());
    }

    res.send({
        fileToInfo: db.getFileToInfo(),
        allThumbnails: allThumbnails
    }); 
});

module.exports = router;
