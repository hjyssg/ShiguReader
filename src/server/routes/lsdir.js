
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
const { loopEachFileInfo } = db;;
const util = global.requireUtil();
const { getCurrentTime, isDisplayableInExplorer } = util;
const path = require('path');
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo }  = zipInfoDb;
const getThumbnails = serverUtil.common.getThumbnails;
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
    const fileInfos = {};
    const oneLevel = !isRecursive;
    const pTokens = dir.split(path.sep);
    const plength = pTokens.length;

    loopEachFileInfo((pp, fileInfo) => {
        if(pp && isDisplayableInExplorer(pp) && isSub(dir, pp, pTokens)){
            //add file's parent dir
            //because we do not track dir in the server
            if(oneLevel && !isDirectParent(dir, pp)){
                //for example
                //the dir is     F:/git 
                //the file is    F:/git/a/b/1.zip
                //add folder           F:/git/a
                const cTokens = pp.split(path.sep);
                let itsParent = pTokens.concat(cTokens[plength]);
                dirs.push(itsParent.join(path.sep));
            }else{
                fileInfos[pp] = fileInfo;
            }
        }
    })

    const _dirs = _.uniq(dirs);

    const time2 = getCurrentTime();
    const timeUsed = (time2 - time1)/1000;
    // console.log(timeUsed, "to LsDir")

    const files = _.keys(fileInfos);

    result = { dirs: _dirs, 
               path: dir, 
               fileInfos, 
               thumbnails: getThumbnails(files),
               zipInfo: getZipInfo(files)
            };
    res.send(result);
});

module.exports = router;
