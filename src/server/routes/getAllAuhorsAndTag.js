const express = require('express');
const router = express.Router();
const util = global.requireUtil();

const db = require("../models/db");
const { getAllFilePathes } = db;
const serverUtil = require("../serverUtil");
const getThumbnails = serverUtil.common.getThumbnails;


// three para 1.mode 2.text
router.post("/api/getAllAuhorsAndTag", (req, res) => {

        allThumbnails = getThumbnails(getAllFilePathes());

    res.send({
        authorTable: global.authorTable,
        tagTable: global.tagTable,
        allThumbnails
    });
});

module.exports = router;
