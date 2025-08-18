const express = require("express");
const router = express.Router();
const serverUtil = require("../serverUtil");
const { searchByText } = require("../searchUtil");
const db = require("../models/db");
const { extractMiddleChars } = require("../BookCompareUtil");

router.post("/api/check_pc_has_file", serverUtil.asyncWrapper(async (req, res) => {
    const text = req.body && req.body.text;
    if (!text) {
        res.send({ exists: false });
        return;
    }
    const middle = extractMiddleChars(text);
    const fileRes = await searchByText(middle);
    if (fileRes.explorerfileResult.length) {
        res.send({ exists: true });
        return;
    }
    const estimate = await db.findEstimateByText(middle);
    res.send({ exists: estimate.length > 0 });
}));

module.exports = router;
