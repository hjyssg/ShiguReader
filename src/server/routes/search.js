const express = require("express");
const router = express.Router();
const {
  searchGenerally,
  searchByText,
  _searchByTag_,
} = require("../searchUtil");
const Constant = global.requireConstant();
const { MODE_TAG, MODE_AUTHOR, MODE_SEARCH } = Constant;
const path = require("path");
const serverUtil = require("../serverUtil");
const BookCompareUtil = require("../BookCompareUtil");
const {
  TOTALLY_DIFFERENT,
  isTwoBookTheSame,
  extractMiddleChars,
} = BookCompareUtil;
const db = require("../models/db");

// three para 1.mode 2.text
router.post(
  "/api/search",
  serverUtil.asyncWrapper(async (req, res) => {
    const mode = req.body && req.body.mode;
    const textParam = req.body && req.body.text;

    const tag = mode === MODE_TAG && textParam;
    const author = mode === MODE_AUTHOR && textParam;
    const text = mode === MODE_SEARCH && textParam;

    if (!author && !tag && !text) {
      res.send({ failed: true, reason: "No parameter" });
    } else {
      const temp = await searchGenerally(tag, author, text);
      res.send(temp);
    }
  })
);

router.post(
  "/api/simple_search/:text",
  serverUtil.asyncWrapper(async (req, res) => {
    const text = req.params.text;
    const temp = await searchByText(text);
    const { explorerfileResult } = temp;

    const fn = (filePath) => path.basename(filePath, path.extname(filePath));

    res.send(explorerfileResult.map((e) => fn(e.fileName)));
  })
);

router.post(
  "/api/findSimilarFile/:text",
  serverUtil.asyncWrapper(async (req, res) => {
    const text = req.params.text;

    const fileRows = [];
    const estimateRows = [];

    const parseResult = serverUtil.parse(text);
    let estimateSearchText = text;

    if (parseResult) {
      if (parseResult.author) {
        const temp = await _searchByTag_(parseResult.author, "author");
        fileRows.push(...temp.explorerfileResult);
      }
      if (parseResult.title) {
        const middleTitle = extractMiddleChars(parseResult.title);
        const temp = await searchByText(middleTitle);
        fileRows.push(...temp.explorerfileResult);
        estimateSearchText = parseResult.title;
      }
    }

    const middleText = extractMiddleChars(text);
    const middleResult = await searchByText(middleText);
    fileRows.push(...middleResult.explorerfileResult);

    // query estimate table in multiple ways
    estimateRows.push(
      ...(await db.findEstimateByText(extractMiddleChars(estimateSearchText)))
    );
    estimateRows.push(...(await db.findEstimateByText(extractMiddleChars(text))));
    estimateRows.push(...(await db.findEstimateByText(text)));

    const result = [];
    const seen = {};

    function merge(rows, bonus) {
      for (const row of rows) {
        const fn = row.fileName;
        if (seen[fn]) continue;
        seen[fn] = true;
        const score = isTwoBookTheSame(text, fn) + bonus;
        if (score >= TOTALLY_DIFFERENT) {
          result.push({ fn, score });
        }
      }
    }

    merge(fileRows, 1); // direct file hits get extra confidence
    merge(estimateRows, 0);

    result.sort((a, b) => b.score - a.score);
    res.send(result);
  })
);

module.exports = router;

