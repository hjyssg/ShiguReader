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
const util = global.requireUtil();
const BookCompareUtil = require("../BookCompareUtil");
const {
    TOTALLY_DIFFERENT,
    isTwoBookTheSame,
    extractMiddleChars
} = BookCompareUtil;
const _ = require("underscore");

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
      const temp = await searchGenerally(tag, author, text);
      res.send(temp);
    }
  })
);

router.post("/api/simple_search/:text", serverUtil.asyncWrapper(async (req, res) => {
    const text = req.params.text;
    const temp = await searchByText(text);
    const { explorerfileResult } = temp;

    const fn = (filePath) => path.basename(filePath, path.extname(filePath));

    res.send(explorerfileResult.map((e) => fn(e.fileName)));
  })
);



router.post("/api/findSimilarFile/:text", serverUtil.asyncWrapper(async (req, res) => {
    const text = req.params.text;
    let rawRows = [];
    // if (util.isAv(text)) {
    // const middleTitle = extractMiddleChars(parseResult.title);
    // rawRows = await searchByText(middleTitle);
 
    const parseResult = serverUtil.parse(text);
    if (parseResult) {
        // TODO 假设单作者
        if (parseResult.author) {
            const temp = await _searchByTag_(parseResult.author, "author");
            rawRows.push(...temp.explorerfileResult);
        } else if (parseResult.title) {
            const middleTitle = extractMiddleChars(parseResult.title);
            const temp = await searchByText(middleTitle);
            rawRows.push(...temp.explorerfileResult);
        } 
    }
    
    if(rawRows.length == 0){
        const middleTitle = extractMiddleChars(text);
        const temp = await searchByText(middleTitle);
        rawRows.push(...temp.explorerfileResult);
    }

    let result = [];
    const checkFns = {};
    function foo(rows){
        for(let ii = 0; ii < rows.length; ii++){
            const row = rows[ii];
            const fn = row.fileName;
            if(checkFns[fn]){
                continue;
            }
            checkFns[fn] = true;
            const score = isTwoBookTheSame(text, fn);
            if(score >= TOTALLY_DIFFERENT){
                result.push({fn, score});
            }
        }
    }
    foo(rawRows);

    result = _.sortBy(result, e=>e.score);
    result.reverse();
    res.send(result);
  })
);

module.exports = router;
