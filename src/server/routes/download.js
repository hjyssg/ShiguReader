
const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const express = require('express');
const router = express.Router();
const util = global.requireUtil();
const { isImage, isGif } = util;

const stringHash = require("string-hash");
const pfs = require('promise-fs');
const path = require('path');

let sharp;
try{
    sharp = require('sharp')
}catch(e){
    console.error("did not install sharp", e);
}

const cacheDb = require("../models/cacheDb");
const THUMBNAIL_HUGE_THRESHOLD = 2 * 1000 * 1000;

//------------------download------------
router.get('/api/download/', async (req, res) => {
    let filePath = path.resolve(req.query.p);
    let thumbnailMode = req.query.thumbnailMode;
    if (!filePath) {
        console.error("[/api/download]", filePath, "NO Param");
        res.send({ failed: true, reason: "NO Param" });
        return;
    }

    if (!cacheDb.isFileInCache(filePath) && !(await isExist(filePath))) {
        console.error("[/api/download]", filePath, "NOT FOUND");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    try {
        if (isImage(filePath) && !isGif(filePath) && thumbnailMode ) {
            const stat = await pfs.statSync(filePath);
            if(stat.size > THUMBNAIL_HUGE_THRESHOLD) {
                const outputFn = stringHash(filePath).toString() + "-min.jpg";
                const outputPath = path.resolve(global.cachePath, outputFn);
                if (!cacheDb.isFileInCache(outputPath)) {
                    await sharp(filePath).resize({ height: 280 }).toFile(outputPath);
                }
                filePath = outputPath;
            }
        }
    } catch (e) {
        console.error(e);
    }

    res.download(filePath); // Set disposition and send it.
});

module.exports = router;
