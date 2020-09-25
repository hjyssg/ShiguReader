
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
const { loopEachFileInfo, getFileCollection, getFileToInfo, getFakeZipInfo } = db;
const util = global.requireUtil();
const { getCurrentTime, isDisplayableInExplorer, escapeRegExp, isImage, isMusic } = util;
const path = require('path');
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo }  = zipInfoDb;
const { getThumbnails } = serverUtil.common;
const { getDirName } = serverUtil;
const _ = require('underscore');


router.post('/api/lsDir', async (req, res) => {
    const dir = req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        console.error("[/api/lsDir]", dir, "does not exist");
        res.sendStatus(404);
        return;
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
                  .find({'filePath': { '$regex' : reg }, isDisplayableInExplorer: true })
                  .where(obj => isSub(dir, obj.filePath)).data();

    function addParent(pp){
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
        if(pp === dir){
            return;
        }
        if(isRecursive){
            fileInfos[pp] = getFileToInfo(pp);
        }else {
            if(isDirectParent(dir, pp)){
                fileInfos[pp] = getFileToInfo(pp);
            }else{
                addParent(pp);
            }
        }
    })

    const fake_zip_results = getFileCollection()
    .chain()
    .find({'filePath': { '$regex' : reg }, isDisplayableInOnebook: true })
    .where(obj => isSub(dir, obj.filePath)).data();

    const fakeZips = {};

    fake_zip_results.forEach(obj => {
        //reduce by its parent folder
        const pp = path.dirname(obj.filePath);
        if(pp === dir){
            return;
        }

        if(isRecursive){
            fakeZips[pp] = fakeZips[pp] || [];
            fakeZips[pp].push(obj.filePath);
        }else {
            if(isDirectParent(dir, pp)){
                fakeZips[pp] = fakeZips[pp] || [];
                fakeZips[pp].push(obj.filePath);
            }else{
                addParent(pp);
            }
        }
    })

    const fakeZipInfo = getFakeZipInfo(fakeZips);

    const time2 = getCurrentTime();
    const timeUsed = (time2 - time1)/1000;
    // console.log(timeUsed, "to LsDir")

    const files = _.keys(fileInfos);
    const _dirs = _.uniq(dirs);


    result = { dirs: _dirs, 
               path: dir, 
               fileInfos, 
               fakeZipInfo,
               fakeZips,
               thumbnails: getThumbnails(files),
               zipInfo: getZipInfo(files),
               guessIfUserLike: serverUtil.common.guessIfUserLike(files)
            };
    res.send(result);
});

router.post('/api/listFolderContent', async (req, res) => {
    let filePath =  req.body && req.body.filePath;
    if (!filePath) {
        console.error("[/api/listFolderContent]", filePath, "does not exist");
        res.sendStatus(404);
        return;
    }

    let result;
    const reg = escapeRegExp(filePath);
    const fake_zip_results = getFileCollection()
    .chain()
    .find({'filePath': { '$regex' : reg }, isDisplayableInOnebook: true })
    .data();

    const _files = fake_zip_results.map(e => e.filePath);

    const files = _files.filter(isImage)
    const musicFiles = _files.filter(isMusic);

    result = { zipInfo : {}, path: filePath, stat: {}, files,  musicFiles };
    res.send(result);
});

module.exports = router;
