const express = require('express');
const router = express.Router();
const searchByTagAndAuthor = require("../searchUtil");
const Constant = global.requireConstant();
const { MODE_TAG, MODE_AUTHOR, MODE_SEARCH } = Constant;

// three para 1.mode 2.text
router.post("/api/search", async (req, res) => {
    const mode = req.body && req.body.mode;
    const textParam = req.body && req.body.text;

    const tag = mode === MODE_TAG && textParam;
    const author = mode === MODE_AUTHOR && textParam;
    const text = mode === MODE_SEARCH && textParam;

    if (!author && !tag && !text) {
        res.send({ failed: true, reason: "No parameter" });
    } else {
        const temp = await searchByTagAndAuthor(tag, author, text);
        res.send(temp);
    }
});

module.exports = router;
