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
const { getFileToInfo} = db;
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
    const tempFileTable = "TEMP.FILE_TABLE_" + suffix;
    // const tempDirTable = "TEMP.DIR_TABLE_" + suffix;

    try {
        let time2, timeUsed;
        let dirs = [];
        let fileInfos = {};

        let sql, rows;

        const sep = "|---|"

        //limit the searching  within this dir
        // 重复使用的临时table
        sql = `CREATE TABLE ${tempFileTable} AS SELECT * FROM file_table WHERE INSTR(filePath, ?) = 1;
               CREATE INDEX IF NOT EXISTS ${tempFileTable}_filePath_index ON ${tempFileTable} (filePath);
               CREATE INDEX IF NOT EXISTS ${tempFileTable}_dirPath_index ON ${tempFileTable} (dirPath);
        `;
        await sqldb.runSync(sql, [dir]);

        //todo: LIMIT 0, 5 group by
        //-------------- dir --------------
        if (!isRecursive) {
            // sql = `CREATE TABLE ${tempDirTable} AS SELECT * FROM ${tempFileTable} WHERE dirPath = ? AND isFolder = true`;
            // await sqldb.runSync(sql, [dir]);

            // //todo: group_concat is ugly
            // // in order to get folder's files, join file_Table and then group by
            // sql = `SELECT a.filePath, group_concat(b.fileName, '${sep}') as files  
            //         FROM ${tempDirTable} AS a LEFT JOIN  
            //         ${tempFileTable} AS b  
            //         ON a.filePath = b.dirPath  
            //         GROUP by a.fileName `
            //
            // CREATE VIEW filtered_dirs AS  SELECT * FROM ${tempFileTable} WHERE dirPath = '${dir}' AND isFolder = true;

            sql = `
                SELECT a.filePath, group_concat(b.fileName, '${sep}') as files  
                FROM ${tempFileTable} AS a 
                LEFT JOIN  
                ${tempFileTable} AS b  
                ON a.filePath = b.dirPath  
                WHERE a.dirPath = ? AND a.isFolder = true
                GROUP by a.fileName;
            `
            rows = await sqldb.allSync(sql, dir);
            dirs = rows.map(e => e.filePath);
        }

        //-------------------files -----------------
        if (isRecursive) {
            sql = `SELECT filePath FROM ${tempFileTable}`;
            rows = await sqldb.allSync(sql);
        } else {
            sql = `SELECT filePath FROM ${tempFileTable} WHERE dirPath = ?`;
            rows = await sqldb.allSync(sql, [dir]);
        }
        rows.forEach(obj => {
            const fp = obj.filePath;
            if (fp === dir) {
                return;
            }
            fileInfos[fp] = getFileToInfo(fp);
        })

        //---------------img folder -----------------
        const imgFolders = {};
        sql = `SELECT dirPath, group_concat(fileName, '${sep}') AS files 
              FROM ${tempFileTable} WHERE isDisplayableInOnebook = true OR isVideo = true
              GROUP BY dirPath`;
        rows = await sqldb.allSync(sql);
        rows.forEach(row => {
            const fp = row.dirPath;
            if (fp === dir || !row.files) {
                return;
            }
            if (!isRecursive && !isDirectParent(dir, fp)) {
                return;
            }
            const files = row.files.split(sep);
            imgFolders[fp] = files.map(e => path.resolve(fp, e));
        })

        //-------------get extra info
        // time2 = getCurrentTime();
        // timeUsed = (time2 - time1) / 1000;
        // console.log("[/api/LsDir] sql time", timeUsed, "s")

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

    const {
        imageFiles,
        musicFiles,
        videoFiles,
        compressFiles
    } = fileIntoCategory(subFpArr);
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

        imageFiles,
        musicFiles,
        videoFiles,
        compressFiles,
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
    }else if (!isAlreadyScan(filePath)) {
        result = await listNoScanDir(filePath, res);
    } else {
        const sqldb = db.getSQLDB();
        let sql = `SELECT filePath FROM file_table WHERE INSTR(filePath, ?) = 1 ORDER BY filePath`;
        let _files = await sqldb.allSync(sql, [filePath]);

        _files = _files.map(e => e.filePath);
         // 单层或者递归，各有利弊，和其他地方逻辑一致吧
         _files = _files.filter(fp => {
            return isDirectParent(filePath, fp)
        });

        const {
            imageFiles,
            musicFiles,
            videoFiles,
            compressFiles
        } = fileIntoCategory(_files);

        const mapping = {};
        mapping[filePath] = _files;
        const info = db.getImgFolderInfo(mapping)[filePath];

        result = {
            zipInfo: info,
            stat: info,
            path: filePath,
            imageFiles,
            musicFiles,
            videoFiles,
        };
    }

    if (result && !noMedataInfo) {
        result.mecab_tokens = await global.mecab_getTokens(filePath);
    }
    res.send(result);
    historyDb.addOneRecord(filePath);
}));

module.exports = router;
