
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const util = global.requireUtil();
const { isImage, isGif } = util;

const stringHash = require("string-hash");
const pfs = require('promise-fs');
const path = require('path');


//------------------download------------
router.get('/api/download/', async (req, res) => {
    let filepath = req.query.p;
    let thumbnailMode = req.query.thumbnailMode;
    if (!filepath || !(await isExist(filepath))) {
        console.error("[/api/download]", filepath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    try {
        if (thumbnailMode && isImage(filepath) ) {
            const stat = await pfs.statSync(filepath);
            const HUGE_THRESHOLD = 5 * 1000 * 1000;
            if (stat.size > HUGE_THRESHOLD) {
                const sharp = require('sharp');
                const outputFn = stringHash(filepath).toString() + ".webp";
                const outputPath = path.resolve(global.cachePath, outputFn);
                if (!(await isExist(outputPath))) {
                    await sharp(filepath).resize({ height: 280 }).toFile(outputPath);
                }
                filepath = outputPath;
            }
        }
    } catch (e) {
        console.error(e);
    }


    res.download(filepath); // Set disposition and send it.
});

module.exports = router;
