
const path = require('path');
const filesizeUitl = require('filesize');
const express = require('express');
const router = express.Router();
const pathUtil = require("../utils/path-util");
const { isExist } = pathUtil;
const logger = require("../config/logger");
const db = require("../models/db");

const serverUtil = require("../utils/server-util");
const { getStatAndUpdateDB, deleteCallBack } = require('../services/server-common');

const sevenZipHelp = require("../services/seven-zip");
const { listZipContentAndUpdateDb } = sevenZipHelp;

const { move, trash } = require("../services/file-operations");

const imageMagickHelp = require("../services/image-magick");
imageMagickHelp.init();

const util = require('../common/util');

const pLimit = require('p-limit');
const minify_limit = pLimit(1);

const count = {
    processed: 0,
    saveSpace: 0
};
const minifyZipQue = [];
const minifyDoneArr = [];
router.post('/api/minify/get_minify_queue', serverUtil.asyncWrapper(async (req, res) => {
    res.send({
        minifyZipQue
    })
}));


router.post('/api/minify/overwrite', serverUtil.asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if (minifyZipQue.includes(filePath)) {
        res.send({ failed: true, reason: "still in minify queue" });
        return;
    }

    const newFileStat = await getStatAndUpdateDB(filePath);
    const temp = await listZipContentAndUpdateDb(filePath);
    const newFileImgs = temp.files;

    //fint the original file
    let originalFilePath;
    let allPath = [];
    const fn = path.basename(filePath, path.extname(filePath));
    allPath = minifyDoneArr.filter(e => {
        return path.basename(e, path.extname(e)) == fn;
    })
    if (allPath.length === 0){
        let sql = `SELECT filePath FROM zip_view WHERE fileName LIKE ? AND filePath != ?`;
        allPath = await db.doSmartAllSync(sql, [('%' + fn + '%'), filePath]);
        allPath = allPath.map(obj => obj.filePath)
    }

    for (let ii = 0; ii < allPath.length; ii++) {
        let fp = allPath[ii];
        if (!(await isExist(fp))) {
            continue;
        }

        let ppFn = path.basename(fp, path.extname(fp));
        if (ppFn === fn) {
            const oldTemp = await listZipContentAndUpdateDb(fp);
            const oldFileImgs = oldTemp.files;
            const oldFileStat = await getStatAndUpdateDB(fp);

            if (oldFileStat.size > newFileStat.size && imageMagickHelp.isNewZipSameWithOriginalFiles(newFileImgs, oldFileImgs)) {
                originalFilePath = fp;
                break;
            }
        }
    }

    if (originalFilePath) {
        //do the overwrite
        await trash(originalFilePath);
        // 删除旧的zip信息
        deleteCallBack(originalFilePath);

        const newPath = path.join(path.dirname(originalFilePath), path.basename(filePath));
        const { stdout, stderr } = move(filePath, newPath);
        if (!stderr) {
            logger.info("[overwrite]", "\n", originalFilePath, "\n", filePath);
            res.send({ failed: false });
        } else {
            logger.error("[overwrite]", "fail at", filePath);
            res.send({ reason: "fail to overwite original file", failed: true });
        }
    } else {
        res.send({ reason: "fail to find original file", failed: true });
    }
}));

router.post('/api/isAbleToMinify', serverUtil.asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    let text = await imageMagickHelp.isConvertable(filePath);
    if (text === "allow_to_minify") {
        res.send({ failed: false })
    } else {
        res.send({ failed: true, reason: text })
    }

}));

router.post('/api/minify/minify', serverUtil.asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
    } else if (minifyZipQue.includes(filePath)) {
        res.send({ failed: true, reason: "Already in the minify queue" });
    } else {
        //add to queue
        //it takes long time
        res.send({ failed: false });
    }

    minifyZipQue.push(filePath);
    try {
        let temp;
        if (util.isCompress(filePath)) {
            temp = await minify_limit(() => imageMagickHelp.minifyOneFile(filePath));
        } else {
            temp = await minify_limit(() => imageMagickHelp.minifyFolder(filePath));
        }
        if (temp) {
            //only success will return result
            const { saveSpace } = temp;
            count.processed++
            count.saveSpace += saveSpace;
            logger.info("[/api/minify/minify] total space save:", filesizeUitl(count.saveSpace, { base: 2 }))
        }
    } catch (e) {
        logger.error("[/api/minify/minify]", e);
    } finally {
        const tempItem = minifyZipQue.shift();
        minifyDoneArr.push(tempItem);
        if (minifyZipQue.length === 0) {
            console.log("[/api/minify/minify] the task queue is now empty");
        }
    }
}));

module.exports = router;
