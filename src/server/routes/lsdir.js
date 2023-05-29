const express = require('express');
const router = express.Router();
// const _ = require('underscore');
const stringHash = require("string-hash");
const path = require('path');
const pfs = require('promise-fs');

const pathUtil = require("../pathUtil");
const {
    isExist,
    isDirectParent,
    isSub
} = pathUtil;

const serverUtil = require("../serverUtil");
const db = require("../models/db");
const util = global.requireUtil();
const { getCurrentTime, isImage, isMusic, isCompress, isVideo } = util;
const { isAlreadyScan, decorateResWithMeta } = serverUtil.common;
const historyDb = require("../models/historyDb");
const logger = require("../logger");


router.post('/api/lsDir', serverUtil.asyncWrapper(async (req, res) => {
    let dir = req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        logger.error("[/api/lsDir]", dir, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    //remove '\' at the end
    // if (dir.length > 2 && dir[dir.length - 1] === path.sep) {
    //     dir = dir.slice(0, dir.length - 1)
    // }
    dir = path.resolve(dir);

    if (!isAlreadyScan(dir)) {
        let result = await listNoScanDir(dir, res);
        result = await decorateResWithMeta(result);
        historyDb.addOneLsDirRecord(dir);
        res.send(result);
        return;
    }

    const time1 = getCurrentTime();
    const sqldb = db.getSQLDB();
    const suffix = stringHash(dir) + time1;
    const tempFileTable = "TEMP_FILE_TABLE_" + suffix;

    try {
        let time2, timeUsed;
        let dirs = [];
        let fileInfos = {};

        let sql, rows;

        //limit the searching  within this dir
        // 重复使用的临时table
        sql = `CREATE TABLE ${tempFileTable} AS SELECT * FROM file_table WHERE INSTR(filePath, ?) = 1 AND filePath != ?;
               CREATE INDEX IF NOT EXISTS ${tempFileTable}_filePath_index ON ${tempFileTable} (filePath);
               CREATE INDEX IF NOT EXISTS ${tempFileTable}_dirPath_index ON ${tempFileTable} (dirPath);
        `;
        await sqldb.runSync(sql, [dir, dir]);

        //-------------- dir --------------
        if (!isRecursive) {
            sql = `SELECT filePath FROM ${tempFileTable} WHERE dirPath = ? AND isFolder=true `
            rows = await sqldb.allSync(sql, dir);
            dirs = rows.map(e => e.filePath);
        }

        //-------------------files -----------------
        if (isRecursive) {
            sql = `SELECT * FROM ${tempFileTable} WHERE isFolder=false`;
            rows = await sqldb.allSync(sql);
        } else {
            sql = `SELECT * FROM ${tempFileTable} WHERE dirPath = ? AND isFolder=false`;
            rows = await sqldb.allSync(sql, [dir]);
        }
        fileInfos = serverUtil.convertFileRowsIntoFileInfo(rows);

        //---------------img folder -----------------
        const imgFolders = {};
        // join folder with isDisplayableInOnebook file
        if(isRecursive){
            sql = `
            SELECT B.filePath, B.dirPath FROM
             (SELECT filePath FROM ${tempFileTable} WHERE isFolder=true ) DT
             INNER JOIN ${tempFileTable} B
             ON DT.filePath=B.dirPath AND B.isDisplayableInOnebook=True
            `
            rows = await sqldb.allSync(sql);
        }else{
            sql = `
            SELECT B.filePath, B.dirPath FROM
             (SELECT filePath FROM ${tempFileTable}  WHERE dirPath = ? AND isFolder=true ) DT
             INNER JOIN ${tempFileTable} B
             ON DT.filePath=B.dirPath AND B.isDisplayableInOnebook=True
            `
            rows = await sqldb.allSync(sql, dir);
        }
        rows.forEach(row => {
            const dirPath = row.dirPath;
            imgFolders[dirPath] = imgFolders[dirPath] || [];
            imgFolders[dirPath].push(row.filePath);
        })


        //-------------get extra info
        time2 = getCurrentTime();
        timeUsed = (time2 - time1) / 1000;
        console.log("[/api/LsDir] sql time", timeUsed, "s")

        let result = {
            path: dir,
            dirs,
            fileInfos,
            imgFolders
        };

        result = await decorateResWithMeta(result);
        // const time3 = getCurrentTime();
        // timeUsed = (time3 - time2) / 1000;
        // console.log("[/api/LsDir] info look", timeUsed, "s")
        historyDb.addOneLsDirRecord(dir);
        res.send(result);
    } catch (e) {
        logger.error(e);
        res.send({ failed: true, reason: e });
    } finally {
        //drop
        let sql = `DROP TABLE IF EXISTS ${tempFileTable}`;
        sqldb.run(sql);
        // sql = `DROP TABLE IF EXISTS ${tempDirTable}`
        // sqldb.run(sql);
    }
}));


function fileIntoCategory(files){
    const imageFiles = [];
    const musicFiles = [];
    const videoFiles = [];
    const compressFiles = [];

    files.forEach(fp => {
        if(isImage(fp)){
            imageFiles.push(fp);
        }else if (isVideo(fp)){
            videoFiles.push(fp);
        }else if(isMusic(fp)){
            musicFiles.push(fp);
        }else if(isCompress(fp)){
            compressFiles.push(fp);
        }
    })

    return {
        imageFiles,
        musicFiles,
        videoFiles,
        compressFiles
    }
}

async function listNoScanDir(filePath, res, isRecussive) {
    let subFpArr = [];
    if(isRecussive){
        await pathUtil.readdirRecursive(filePath, subFpArr);
    }else{
        let subFnArr = await pathUtil.readdirOneLevel(filePath);
        subFpArr = subFnArr.map(e => path.resolve(filePath, e));
    }

    const categoryObj  = fileIntoCategory(subFpArr);
    const dirs = subFpArr.filter(e => {
        const isFolder = pathUtil.estimateIfFolder(e);
        return isFolder;
    })

    const fileInfos = {};
    subFpArr.forEach(e => {
        fileInfos[e] = {};
    })

    let result = {
        path: filePath,
        mode: "lack_info_mode",

        // stat: {},
        dirs,
        imgFolders: {},
        fileInfos,

        ...categoryObj
    };
    
    return result;
}

router.post('/api/listImageFolderContent', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const noMedataInfo = req.body && req.body.noMedataInfo;
    if (!filePath || !(await isExist(filePath))) {
        logger.error("[/api/listImageFolderContent]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    const stat = await pfs.stat(filePath);
    if (!stat.isDirectory()) {
        res.send({ failed: true, reason: "NOT FOLDER" });
        return;
    }

    let result;
    // 除了cache以外都不递归
    if(isSub(global.cachePath, filePath)){
        result = await listNoScanDir(filePath, res, true);
    }else {
        result = await listNoScanDir(filePath, res);
    }

    result = {
        zipInfo: null,
        stat: null,
        outputPath: null,
        ...result
    }
    
    if (result && !noMedataInfo) {
        result.mecab_tokens = await global.mecab_getTokens(filePath);
    }
    result = serverUtil.common.checkOneBookRes(result);
    res.send(result);
    historyDb.addOneRecord(filePath);
}));

module.exports = router;
