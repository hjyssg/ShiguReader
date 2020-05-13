
const pathUtil = require("../pathUtil");
const {
        isExist
} = pathUtil;

const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");

//------------------download------------
router.get('/api/download/:hash', async (req, res) => {
    const filepath = db.hashTable[req.params.hash];

    if (!filepath || !(await isExist(filepath))) {
        console.error("[/api/download]", filepath, "does not exist");
        res.sendStatus(404);
        return;
    }
    res.download(filepath); // Set disposition and send it.
});

module.exports = router;
