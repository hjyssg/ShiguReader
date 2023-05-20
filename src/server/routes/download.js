
const stringHash = require("string-hash");
const pfs = require('promise-fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const util = global.requireUtil();
const { isImage, isGif } = util;
const serverUtil = require("../serverUtil");


const pathUtil = require("../pathUtil");
const { isExist } = pathUtil;
const memorycache = require('memory-cache');

let sharp;


const THUMBNAIL_HUGE_THRESHOLD = 2 * 1000 * 1000;  //MB
const ONEBOOK_HUGE_THRESHOLD_REMOTE = 3 * 1000 * 1000;  // MB
const ONEBOOK_HUGE_THRESHOLD_LOCAL = 10 * 1000 * 1000;  // MB


//------------------download------------
router.get('/api/download/', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = path.resolve(req.query.p);
    let thumbnailMode = req.query.thumbnailMode;
    if (!filePath) {
        console.error("[/api/download]", filePath, "NO Param");
        res.send({ failed: true, reason: "NO Param" });
        return;
    }

    const logLabel = '[/api/download/]  ' + filePath;
    // console.time(logLabel);
    const time1 = util.getCurrentTime();

    if (!(await isExist(filePath))) {
        console.error("[/api/download]", filePath, "NOT FOUND");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "";
    const cacheKey = req.url + ip;
    const isLocalClient = ip.includes("127.0.0.1");
    const onebook_huge_threshold = isLocalClient? ONEBOOK_HUGE_THRESHOLD_LOCAL: ONEBOOK_HUGE_THRESHOLD_REMOTE;
    try {
        if (sharp && isImage(filePath) && !isGif(filePath)) {
            if(memorycache.get(cacheKey)){
                filePath = memorycache.get(cacheKey);
            }else{
                const stat = await pfs.stat(filePath);
                if (thumbnailMode && stat.size > THUMBNAIL_HUGE_THRESHOLD) {
                    const outputFn = stringHash(filePath).toString() + "-min.jpg";
                    const outputPath = path.resolve(global.cachePath, outputFn);
                    if (!(await isExist(outputPath))) {
                        await sharp(filePath).resize({ height: 280 }).toFile(outputPath);
                    }
                    memorycache.put(cacheKey, outputPath, 60*1000);
                    filePath = outputPath;
                }else if(stat.size > onebook_huge_threshold){
                    const outputFn = stringHash(filePath).toString() + "-min-2.jpg";
                    const outputPath = path.resolve(global.cachePath, outputFn);
                    if (!(await isExist(outputPath))) {
                        await sharp(filePath).resize({ height: 1980 }).toFile(outputPath);
                    }
                    memorycache.put(cacheKey, outputPath, 60*1000);
                    filePath = outputPath;
                }
            }
        }
    } catch (e) {
        console.error("[file server error] during compression",e);
    }

    // cache 1 hour
    if(isImage(filePath)){
        res.setHeader('Cache-Control', 'public, max-age=3600');
        // 下载多个thumbnail的时候，不要每次都重新TCP握手
        // https://serverfault.com/questions/790197/what-does-connection-close-mean-when-used-in-the-response-message
        // the initial connection refers to the time it takes to perform the initial TCP handshake and negotiate SSL (if applicable) for an HTTP request. 
        //It is a stage in which the browser is establishing a connection, including TCP handshake and retrying, and negotiating SSL.
        res.setHeader('Connection', 'Keep-Alive');
        res.setHeader('Keep-Alive', 'timeout=50, max=1000');
    }
    res.download(filePath); // Set disposition and send it.

    // console.timeEnd(logLabel);
    const time2 = util.getCurrentTime();
    const timeUsed = (time2 - time1);
    // console.log(logLabel, timeUsed, "ms")
}));

module.exports = router;
