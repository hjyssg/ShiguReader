
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

const db = require("../models/db");
const THUMBNAIL_HUGE_THRESHOLD = 2 * 1000 * 1000;
const IMG_HUGE_THRESHOLD = 15 * 1000 * 1000;

//------------------download------------
router.get('/api/download/', async (req, res) => {
    let filepath = path.resolve(req.query.p);
    let thumbnailMode = req.query.thumbnailMode;
    if (!filepath) {
        console.error("[/api/download]", filepath, "NO Param");
        res.send({ failed: true, reason: "NO Param" });
        return;
    }

    if (!db.isFileInCache(filepath) && !(await isExist(filepath))) {
        console.error("[/api/download]", filepath, "NOT FOUND");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    try {
        if (isImage(filepath) && thumbnailMode ) {
            const stat = await pfs.statSync(filepath);
            if(stat.size > THUMBNAIL_HUGE_THRESHOLD) {
                const outputFn = stringHash(filepath).toString() + "-min.jpg";
                const outputPath = path.resolve(global.cachePath, outputFn);
                if (!db.isFileInCache(outputPath)) {
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
