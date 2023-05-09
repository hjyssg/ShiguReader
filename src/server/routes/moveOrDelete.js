const path = require('path');
const pfs = require('promise-fs');
const execa = require('../own_execa');
const userConfig = global.requireUserConfig();
const isWindows = require('is-windows');
const express = require('express');
const router = express.Router();
const logger = require("../logger");

const pathUtil = require("../pathUtil");
const {
    isExist,
    getZipOutputCachePath
} = pathUtil;

const util = global.requireUtil();
const { isImage, isCompress, isMusic, isDisplayableInOnebook } = util;

const serverUtil = require("../serverUtil");
const { mkdir } = serverUtil;

const sevenZipHelp = require("../sevenZipHelp");

function getReason(e) {
    return e.stderr || e.message || e;
}


router.post('/api/renameFile', serverUtil.asyncWrapper(async (req, res) => {
    const src = req.body && req.body.src;
    const dest = req.body && req.body.dest;

    if (!src || !dest) {
        res.send({ failed: true, reason: "No parameter" });
        return;
    }

    if (!(await isExist(src))) {
        res.send({ failed: true, reason: src + " is missing" });
        return;
    }


    try {
        let err = await pfs.rename(src, dest);

        if (err) { throw err; }

        // logger.info(`[rename] ${src} to ${dest}`);
        res.send({ failed: false, dest });

        serverUtil.common.moveCallBack(src, dest);
    } catch (err) {
        console.error(err);
        res.send({ reason: getReason(err), failed: true });
    }
}));

router.post('/api/moveFile', serverUtil.asyncWrapper(async (req, res) => {
    const src = req.body && req.body.src;
    let dest = req.body && req.body.dest;

    if (!src || !dest) {
        res.send({ failed: true, reason: "No parameter" });
        return;
    }

    const destFP = path.resolve(dest, path.basename(src));
    if (await isExist(destFP)) {
        res.send({ failed: true, reason: `duplicate file already in ${dest}` });
        return;
    }


    if (!(await isExist(src))) {
        res.send({ failed: true, reason: src + " is missing" });
        return;
    }

    try {
        let err;
        if (!(await isExist(dest))) {
            err = await mkdir(dest);
            if (err instanceof Error) {
                throw "fail to create dest folder";
            }
        }

        const cmdStr = isWindows() ? "move" : "mv";
        const { stdout, stderr } = await execa(cmdStr, [src, dest]);
        err = stderr;

        if (err) { throw err; }

        // logger.info(`[MOVE] ${src} to ${dest}`);

        res.send({ failed: false, dest: destFP });

        serverUtil.common.moveCallBack(src, dest);
    } catch (err) {
        console.error(err);
        res.send({ reason: getReason(err), failed: true });
    }
}));

async function deleteThing(src) {
    if (userConfig.move_file_to_recyle) {
        const trash = require('trash');
        await trash([src]);
    } else {
        const err = await pfs.unlink(src)
        if (err) { throw err; }
    }
}

async function isSimpleFolder(src) {
    let content_pathes = await pfs.readdir(src);
    const otherTypes = content_pathes.filter(e => !isDisplayableInOnebook(e));

    return otherTypes.length === 0;
}

const _folder_waring_ = "This folder is not a one-level img/music folder";
const file_occupy_warning = "File may be used by another process"

router.post('/api/deleteFile', serverUtil.asyncWrapper(async (req, res) => {
    const src = req.body && req.body.src;

    if (!src || !(await isExist(src))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    try {
        await deleteThing(src);
        res.send({ failed: false });
        // logger.info(`[DELETE] ${src}`);

        serverUtil.common.deleteCallBack(src);
    } catch (e) {
        console.error(e);
        res.send({ reason: file_occupy_warning, failed: true });
    }
}));


router.post('/api/deleteFolder', serverUtil.asyncWrapper(async (req, res) => {
    const src = req.body && req.body.src;

    if (!src || !(await isExist(src))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if (!(await isSimpleFolder(src))) {
        res.send({ reason: _folder_waring_, failed: true });
        return;
    }

    //below is duplicate code as /api/deleteFile
    //need to improve
    try {
        await deleteThing(src);
        res.send({ failed: false });
        // logger.info(`[DELETE] ${src}`);
    } catch (e) {
        console.error(e);
        res.send({ reason: file_occupy_warning, failed: true });
    }
}));

router.post('/api/zipFolder', serverUtil.asyncWrapper(async (req, res) => {
    const src = req.body && req.body.src;

    if (!src || !(await isExist(src))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    // if (!(await isSimpleFolder(src))) {
    //     res.send({ reason: _folder_waring_, failed: true });
    //     return;
    // }

    const outputRoot = getZipOutputCachePath();
    const _resultZipPath = path.resolve(outputRoot, path.basename(src) + ".zip");
    try {
        let { stdout, stderr, resultZipPath } = await sevenZipHelp.zipOneFolder(src, _resultZipPath);
        if (stderr) {
            throw stderr;
        }
        res.send({ failed: false, dest: resultZipPath });
        // logger.info(`[zipFolder] ${src}`);
    } catch (e) {
        console.error(e);
        res.send({ reason: "fail to zip", failed: true });
    }
}));

module.exports = router;
