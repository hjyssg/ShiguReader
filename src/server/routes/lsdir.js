const express = require('express');
const router = express.Router();
// const _ = require('underscore');
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
const historyDb = require("../models/historyDB");
const logger = require("../logger");
const filewatch= require('../own_chokidar/filewatch');
const estimateFileTable = require("../estimateFileTable");

router.post('/api/lsDir', serverUtil.asyncWrapper(async (req, res) => {
    let dir = req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        logger.error("[/api/lsDir]", dir, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    dir = path.resolve(dir);

    if (!filewatch.isAlreadyScan(dir)) {
        let result = await listNoScanDir(dir, res);
        result = await serverUtil.common.decorateResWithMeta(result);
        historyDb.addOneLsDirRecord(dir);
        res.send(result);
        return;
    }

    const time1 = getCurrentTime();

    // 前缀是子文件都搜索
    const recursiveFileSQL = `SELECT * FROM file_table WHERE filePath LIKE ? AND filePath != ?`
    try {
        let time2, timeUsed;
        let dirs = [];
        let fileInfos = {};
        let sql, rows;

        //-------------- dir --------------
        if (!isRecursive) {
            // 单层才有folder
            sql = `SELECT filePath FROM file_table WHERE dirPath = ? AND isFolder`
            rows = await db.doSmartAllSync(sql, [dir]);
            dirs = rows.map(e => e.filePath);
        }

        //-------------------files -----------------
        if (isRecursive) {
            sql = `${recursiveFileSQL} AND isFolder=false`;
            rows = await db.doSmartAllSync(sql, [`${dir}%`, dir]);
        } else {
            sql = `SELECT * FROM file_table WHERE dirPath = ? AND isFolder=false`;
            rows = await db.doSmartAllSync(sql, [dir]);
        }
        fileInfos = serverUtil.convertFileRowsIntoFileInfo(rows);

        //---------------img folder -----------------
        const imgFolders = {};
        // join folder with isDisplayableInOnebook file
        if(isRecursive){
            sql = `
            WITH TT AS (
                ${recursiveFileSQL} 
            )

            SELECT B.* FROM
             TT AS A
             INNER JOIN TT AS B
             ON A.filePath=B.dirPath AND B.isDisplayableInOnebook AND A.isFolder
            `
            rows = await db.doSmartAllSync(sql, [`${dir}%`, dir]);
        }else{
            //单层
            sql = `
            WITH A AS (
                SELECT filePath FROM file_table WHERE dirPath = ? AND isFolder
            ),
            B AS (
                ${recursiveFileSQL} AND isDisplayableInOnebook
            )

            SELECT B.* FROM
             A 
             INNER JOIN B
             ON A.filePath=B.dirPath
            `
            rows = await db.doSmartAllSync(sql, [ dir, `${dir}%`, dir]);
        }
        rows.forEach(row => {
            const dirPath = row.dirPath;
            imgFolders[dirPath] = imgFolders[dirPath] || [];
            imgFolders[dirPath].push(row);
        })


        // -------------get extra info
        time2 = getCurrentTime();
        timeUsed = (time2 - time1);
        // console.log("[/api/LsDir] sql time", timeUsed, "ms")

        let result = {
            path: dir,
            dirs,
            fileInfos,
            imgFolders
        };

        result = await serverUtil.common.decorateResWithMeta(result);
        const time3 = getCurrentTime();
        timeUsed = (time3 - time2);
        // console.log("[/api/LsDir] decorateResWithMeta", timeUsed, "ms")
        historyDb.addOneLsDirRecord(dir);
        res.send(result);
    } catch (e) {
        logger.error(e);
        res.send({ failed: true, reason: e });
    } finally {
        //nothing
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
    const { filePathes, dirPathes } = await pathUtil.readDirForFileAndFolder(filePath, isRecussive);

    estimateFileTable.updateByScan(filePath, filePathes.concat(dirPathes));
    
    const categoryObj  = fileIntoCategory(filePathes);
    const fileInfos = filePathes.reduce((acc, filePath) => {
        acc[filePath] = {};
        return acc;
    }, {});

    let result = {
        path: filePath,
        mode: "lack_info_mode",

        // stat: {},
        dirs: dirPathes,
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
        result.mecab_tokens = [];
    }
    result = serverUtil.checkOneBookRes(result);
    res.send(result);
    historyDb.addOneRecord(filePath);
}));

module.exports = router;
