const pathUtil = require("../pathUtil");
const {
    isExist,
    isDirectParent,
    isSub
} = pathUtil;
const express = require('express');
const router = express.Router();
const serverUtil = require("../serverUtil");
const db = require("../models/db");
const { getFileCollection, getFileToInfo, getImgFolderInfo } = db;
const util = global.requireUtil();
const { getCurrentTime, isDisplayableInExplorer, escapeRegExp, isImage, isMusic } = util;
const path = require('path');
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const { getThumbnails } = serverUtil.common;
const { getDirName } = serverUtil;
const _ = require('underscore');


router.post('/api/listFolderOnly', async (req, res) => {
    let dir = req.body && req.body.dir;

    if (!dir || !(await isExist(dir))) {
        console.error("[/api/lsDir]", dir, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    let pathes = await pfs.readdir(p, { withFileTypes: true });

    res.send({
        pathes
    });
});


router.post('/api/lsDir', async (req, res) => {
    let dir = req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        console.error("[/api/lsDir]", dir, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    //remove '\' at the end
    if (dir.length > 2 && dir[dir.length - 1] === path.sep) {
        dir = dir.slice(0, dir.length - 1)
    }

    const time1 = getCurrentTime();
    let result;
    const dirs = [];
    let fileInfos = {};
    const pTokens = dir.split(path.sep);
    const plength = pTokens.length;

    const reg = escapeRegExp(dir);
    const results = getFileCollection()
        .chain()
        .find({ 'filePath': { '$regex': reg }, isDisplayableInExplorer: true })
        .where(obj => isSub(dir, obj.filePath)).data();

    function addParent(pp) {
        //add file's parent dir
        //because we do not track dir in the server
        //for example
        //the dir is     F:/git 
        //the file is    F:/git/a/b/1.zip
        //add folder           F:/git/a
        const cTokens = pp.split(path.sep);
        let itsParent = pTokens.concat(cTokens[plength]);
        const np = itsParent.join(path.sep);
        dirs.push(np);
    }

    results.forEach(obj => {
        const pp = obj.filePath;
        if (pp === dir) {
            return;
        }
        if (isRecursive) {
            fileInfos[pp] = getFileToInfo(pp);
        } else {
            if (isDirectParent(dir, pp)) {
                fileInfos[pp] = getFileToInfo(pp);
            } else {
                addParent(pp);
            }
        }
    })

    const img_files_results = getFileCollection()
        .chain()
        .find({ 'filePath': { '$regex': reg }, isDisplayableInOnebook: true })
        .where(obj => isSub(dir, obj.filePath)).data();

    const imgFolders = {};

    img_files_results.forEach(obj => {
        //reduce by its parent folder
        const pp = path.dirname(obj.filePath);
        if (pp === dir) {
            return;
        }

        if (isRecursive) {
            imgFolders[pp] = imgFolders[pp] || [];
            imgFolders[pp].push(obj.filePath);
        } else {
            if (isDirectParent(dir, pp)) {
                imgFolders[pp] = imgFolders[pp] || [];
                imgFolders[pp].push(obj.filePath);
            } else {
                addParent(pp);
            }
        }
    })

    const imgFolderInfo = getImgFolderInfo(imgFolders);

    const time2 = getCurrentTime();
    const timeUsed = (time2 - time1) / 1000;
    // console.log(timeUsed, "to LsDir")

    const files = _.keys(fileInfos);
    const _dirs = _.uniq(dirs);


    result = {
        dirs: _dirs,
        path: dir,
        fileInfos,
        imgFolderInfo,
        imgFolders,
        thumbnails: getThumbnails(files),
        zipInfo: getZipInfo(files),
        guessIfUserLike: serverUtil.common.guessIfUserLike(files)
    };
    res.send(result);
});

router.post('/api/listImageFolderContent', async (req, res) => {
    let filePath = req.body && req.body.filePath;
    if (!filePath) {
        console.error("[/api/listImageFolderContent]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    let result;
    const reg = escapeRegExp(filePath);
    const fake_zip_results = getFileCollection()
        .chain()
        .find({ 'filePath': { '$regex': reg }, isDisplayableInOnebook: true })
        .data();

    const _files = [];

    fake_zip_results.forEach(e => {
        const pp = e.filePath;
        if (isDirectParent(filePath, pp)) {
            _files.push(pp);
        }
    });

    const files = _files.filter(isImage)
    const musicFiles = _files.filter(isMusic);

    const mapping = {};
    mapping[filePath] = _files;
    const info = getImgFolderInfo(mapping)[filePath];

    //ugly code here
    result = {
        zipInfo: info,
        stat: info,
        path: filePath,
        files, musicFiles
    };
    res.send(result);
});

module.exports = router;
