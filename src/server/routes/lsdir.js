
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
const getAllFilePathes = db.getAllFilePathes;
const util = require("../../util");
const { getCurrentTime, isDisplayableInExplorer } = util;
const path = require('path');

const getZipInfo = serverUtil.common.getZipInfo;
const getThumbnails = serverUtil.common.getThumbnails;
const _ = require('underscore');


router.post('/api/lsDir', async (req, res) => {
    const hashdir = db.hashTable[(req.body && req.body.hash)];
    const dir = hashdir|| req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        console.error("[/api/lsDir]", dir, "does not exist");
        res.sendStatus(404);
        return;
    }

    const time1 = getCurrentTime();
    let result;
    const files = [];
    const dirs = [];
    const infos = {};
    const oneLevel = !isRecursive;
    getAllFilePathes().forEach(pp => {
        if(pp && isDisplayableInExplorer(pp) && isSub(dir, pp)){
            //add file's parent
            if(oneLevel && !isDirectParent(dir, pp)){
                let itsParent = path.resolve(pp, "..");
   
                //for example
                //the dir is     F:/git 
                //the file is    F:/git/a/b/1.zip
                //add folder           F:/git/a
                let counter = 0;
                while(!isDirectParent(dir, itsParent)){
                    itsParent = path.resolve(itsParent, "..");
                    counter++;

                    //assert
                    if(counter > 200){ throw "[lsdir] while loop" }
                }
                dirs.push(itsParent);
            }else{
                files.push(pp);
                infos[pp] = db.getFileToInfo()[pp]
            }
        }
    })

    const _dirs = _.uniq(dirs);

    const time2 = getCurrentTime();
    const timeUsed = (time2 - time1)/1000;
    // console.log(timeUsed, "to LsDir")

    result = { dirs: _dirs, 
               files, 
               path: dir, 
               fileInfos: infos, 
               thumbnails: getThumbnails(files),
               zipInfo: getZipInfo(files)
            };
    res.send(result);
});

module.exports = router;
