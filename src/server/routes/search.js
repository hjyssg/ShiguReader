const express = require('express');
const router = express.Router();
const { searchByTagAndAuthor, searchByText } = require("../searchUtil");
const Constant = global.requireConstant();
const { MODE_TAG, MODE_AUTHOR, MODE_SEARCH } = Constant;
const path = require('path');
const serverUtil = require("../serverUtil");

// three para 1.mode 2.text
router.post("/api/search", serverUtil.asyncWrapper(async (req, res) => {
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
}));


router.post("/api/simple_search/:text", serverUtil.asyncWrapper(async (req, res) => {
    const text = req.params.text;
    const temp = await searchByText(text);
    const zipResult = temp.zipResult;

    const fn = filePath => path.basename(filePath, path.extname(filePath));

    res.send(zipResult.map(e => fn(e.fileName)));
}));



module.exports = router;
