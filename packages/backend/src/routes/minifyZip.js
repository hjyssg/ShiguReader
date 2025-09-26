
const path = require('path');
const filesizeUitl = require('filesize');
const express = require('express');
const router = express.Router();
const pathUtil = require("../utils/pathUtil");
const { isExist } = pathUtil;
const logger = require("../config/logger");
const db = require("../models/db");

const serverUtil = require("../utils/serverUtil");

const sevenZipHelp = require("../services/sevenZipHelp");
const { listZipContentAndUpdateDb } = sevenZipHelp;

const { move, trash } = require("../services/moveDeleteHelp");

const imageMagickHelp = require("../services/imageMagickHelp");
imageMagickHelp.init();

const util = global.requireUtil();

const pLimit = require('p-limit');
const minify_limit = pLimit(1);

const count = {
    processed: 0,
    saveSpace: 0
};
const minifyZipQue = [];
const minifyDoneArr = [];

async function getFileSizeSafe(targetPath) {
    if (!targetPath) {
        return null;
    }
    try {
        const stat = await serverUtil.common.getStatAndUpdateDB(targetPath);
        if (stat && typeof stat.size === 'number' && !Number.isNaN(stat.size)) {
            return stat.size;
        }
    } catch (error) {
        logger.warn(`[minifyZip] failed to read stat for ${targetPath}`, error);
    }
    return null;
}

async function logJobStart(filePath, sizeBefore) {
    try {
        const startedAt = util.getCurrentTime();
        const fileName = path.basename(filePath);
        const stmt = await db.runSync(
            `INSERT INTO minify_zip_log (filePath, fileName, startedAt, sizeBefore) VALUES (?, ?, ?, ?)`,
            [
                filePath,
                fileName,
                startedAt,
                (typeof sizeBefore === 'number' && !Number.isNaN(sizeBefore)) ? sizeBefore : null
            ]
        );
        return stmt && stmt.lastID;
    } catch (error) {
        logger.warn('[minifyZip] failed to record minify start', error);
    }
    return null;
}

async function logJobSuccess(logId, { resultFilePath, sizeAfter }) {
    if (!logId) {
        return;
    }
    try {
        const finishedAt = util.getCurrentTime();
        const safeSizeAfter = (typeof sizeAfter === 'number' && !Number.isNaN(sizeAfter)) ? sizeAfter : null;
        if (resultFilePath) {
            await db.runSync(
                `UPDATE minify_zip_log SET finishedAt=?, sizeAfter=?, success=1, filePath=?, fileName=? WHERE id=?`,
                [
                    finishedAt,
                    safeSizeAfter,
                    resultFilePath,
                    path.basename(resultFilePath),
                    logId
                ]
            );
        } else {
            await db.runSync(
                `UPDATE minify_zip_log SET finishedAt=?, sizeAfter=?, success=1 WHERE id=?`,
                [finishedAt, safeSizeAfter, logId]
            );
        }
    } catch (error) {
        logger.warn('[minifyZip] failed to record minify success', error);
    }
}

async function logJobFailure(logId) {
    if (!logId) {
        return;
    }
    try {
        const finishedAt = util.getCurrentTime();
        await db.runSync(
            `UPDATE minify_zip_log SET finishedAt=?, success=0 WHERE id=?`,
            [finishedAt, logId]
        );
    } catch (error) {
        logger.warn('[minifyZip] failed to record minify failure', error);
    }
}

async function markLogReplaced(resultFilePath, finalFilePath) {
    if (!resultFilePath) {
        return;
    }
    try {
        let rows = await db.doSmartAllSync(
            `SELECT id FROM minify_zip_log WHERE filePath = ? ORDER BY finishedAt DESC, id DESC LIMIT 1`,
            [resultFilePath]
        );
        let targetId = rows.length > 0 ? rows[0].id : null;
        if (!targetId) {
            const fileName = path.basename(resultFilePath);
            rows = await db.doSmartAllSync(
                `SELECT id FROM minify_zip_log WHERE fileName = ? ORDER BY finishedAt DESC, id DESC LIMIT 1`,
                [fileName]
            );
            targetId = rows.length > 0 ? rows[0].id : null;
        }
        if (!targetId) {
            return;
        }
        const now = util.getCurrentTime();
        const finalPath = finalFilePath || resultFilePath;
        await db.runSync(
            `UPDATE minify_zip_log SET replaced=1, replacedAt=?, filePath=?, fileName=? WHERE id=?`,
            [now, finalPath, path.basename(finalPath), targetId]
        );
    } catch (error) {
        logger.warn('[minifyZip] failed to record overwrite event', error);
    }
}

router.post('/api/minifyZipQue', serverUtil.asyncWrapper(async (req, res) => {
    res.send({
        minifyZipQue
    })
}));


router.post('/api/overwrite', serverUtil.asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
    }

    if (minifyZipQue.includes(filePath)) {
        res.send({ failed: true, reason: "still in minify queue" });
    }

    const newFileStat = await serverUtil.common.getStatAndUpdateDB(filePath);
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
            const oldFileStat = await serverUtil.common.getStatAndUpdateDB(fp);

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
        serverUtil.common.deleteCallBack(originalFilePath);

        const newPath = path.join(path.dirname(originalFilePath), path.basename(filePath));
        const { stdout, stderr } = move(filePath, newPath);
        if (!stderr) {
            await markLogReplaced(filePath, newPath);
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

router.post('/api/minifyZip', serverUtil.asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if (minifyZipQue.includes(filePath)) {
        res.send({ failed: true, reason: "Already in the minify queue" });
        return;
    }

    //add to queue
    //it takes long time
    res.send({ failed: false });

    minifyZipQue.push(filePath);
    let logId = null;
    let logHandled = false;
    try {
        const sizeBefore = await getFileSizeSafe(filePath);
        logId = await logJobStart(filePath, sizeBefore);

        let temp;
        if (util.isCompress(filePath)) {
            temp = await minify_limit(() => imageMagickHelp.minifyOneFile(filePath));
        } else {
            temp = await minify_limit(() => imageMagickHelp.minifyFolder(filePath));
        }
        if (temp && typeof temp.saveSpace === 'number' && !Number.isNaN(temp.saveSpace)) {
            const { saveSpace, resultZipPath } = temp;
            let sizeAfter = null;
            if (resultZipPath && await isExist(resultZipPath)) {
                sizeAfter = await getFileSizeSafe(resultZipPath);
            }
            if (sizeAfter === null && typeof sizeBefore === 'number' && !Number.isNaN(sizeBefore)) {
                const estimated = sizeBefore - saveSpace;
                sizeAfter = estimated >= 0 ? estimated : 0;
            }
            await logJobSuccess(logId, { resultFilePath: resultZipPath, sizeAfter });
            logHandled = true;

            count.processed++
            count.saveSpace += saveSpace;
            logger.info("[/api/minifyZip] total space save:", filesizeUitl(count.saveSpace, { base: 2 }))
        } else {
            await logJobFailure(logId);
            logHandled = true;
        }
    } catch (e) {
        logger.error("[/api/minifyZip]", e);
        if (!logHandled) {
            await logJobFailure(logId);
            logHandled = true;
        }
    } finally {
        const tempItem = minifyZipQue.shift();
        minifyDoneArr.push(tempItem);
        if (minifyZipQue.length === 0) {
            console.log("[/api/minifyZip] the task queue is now empty");
        }
    }
}));

module.exports = router;
