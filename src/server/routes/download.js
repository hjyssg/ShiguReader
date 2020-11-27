
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();

//------------------download------------
router.get('/api/download/', async (req, res) => {
    const filepath = req.query.p;
    if (!filepath || !(await isExist(filepath))) {
        console.error("[/api/download]", filepath, "does not exist");
        res.send({failed: true, reason: "NOT FOUND"});
        return;
    }
    res.download(filepath); // Set disposition and send it.
});

module.exports = router;
