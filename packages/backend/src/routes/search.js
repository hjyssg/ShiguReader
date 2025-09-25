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
const serverUtil = require("../services/serverUtil");
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


router.post("/api/findSimilarFile/:text", serverUtil.asyncWrapper(async (req, res) => {
  const text = req.params.text;
  let fileRows = [];
  let estimateRows = [];
  const parseResult = serverUtil.parse(text);

  if (parseResult) {
    if (parseResult.author) {
      const temp = await _searchByTag_(parseResult.author, "author");
      fileRows.push(...temp.explorerfileResult);

      const tempEstimate = await db.findEstimateByText(parseResult.author);
      estimateRows.push(...tempEstimate);
    }
    if (parseResult.title) {
      const middleTitle = extractMiddleChars(parseResult.title);
      const temp = await searchByText(middleTitle);
      fileRows.push(...temp.explorerfileResult);

      const tempEstimate = await db.findEstimateByText(middleTitle);
      estimateRows.push(...tempEstimate);
    }
  }

  const middleTitle = extractMiddleChars(text);
  const temp = await searchByText(middleTitle);
  fileRows.push(...temp.explorerfileResult);

  const tempEstimate = await db.findEstimateByText(middleTitle);
  estimateRows.push(...tempEstimate);

  const result = [];
  const seen = new Set();

  function merge(rows, bonus) {
    for (const row of rows) {
      const fn = row.fileName;
      if (seen.has(fn)) continue;
      seen.add(fn);
      const score = isTwoBookTheSame(text, fn) + bonus;
      if (score >= TOTALLY_DIFFERENT) {
        result.push({ fn, score });
      }
    }
  }

  merge(fileRows, 0);
  merge(estimateRows, 0);

  result.sort((a, b) => b.score - a.score);
  res.send(result);
}));


module.exports = router;

