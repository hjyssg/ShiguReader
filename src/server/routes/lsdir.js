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
const {  getFileToInfo, getImgFolderInfo } = db;
const util = global.requireUtil();
const { getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook, escapeRegExp, isImage, isMusic, isCompress, isVideo } = util;
const path = require('path');
// const zipInfoDb = require("../models/zipInfoDb");
// const { getZipInfo } = zipInfoDb;
const { isAlreadyScan, _decorate } = serverUtil.common;
const _ = require('underscore');
const readdir = require("../readdir");
const stringHash = require("string-hash");
const historyDb = require("../models/historyDb");


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

    if(!isAlreadyScan(dir)){
        const result = await listNoScanDir(dir, res);
        res.send(result);
        return;
    }

    const sqldb = db.getSQLDB();
    const suffix = stringHash(dir);
    const tempFileTable = "TEMP.FILE_TABLE_" + suffix;
    const tempDirTable = "TEMP.DIR_TABLE_" + suffix;

    try {
        const time1 = getCurrentTime();
        let time2, timeUsed;
        let dirs = [];
        let fileInfos = {};

        let sql, rows;

        const sep = "|---|"

        //limit the searching  within this dir
        sql = `CREATE TABLE ${tempFileTable} AS SELECT * FROM file_table WHERE INSTR(filePath, ?) = 1`;
        await sqldb.runSync(sql, [dir]);

        //todo: LIMIT 0, 5 group by
        //-------------- dir --------------
        if(!isRecursive){
            sql = `CREATE TABLE ${tempDirTable} AS SELECT * FROM ${tempFileTable} WHERE dirPath = ? AND isFolder = true`;
            await sqldb.runSync(sql, [dir]);

            //todo: group_concat is ugly
            // in order to get folder's files, join file_Table and then group by
            sql = `SELECT a.filePath, group_concat(b.fileName, '${sep}') as files ` +
                `FROM ${tempDirTable} AS a LEFT JOIN ` + 
                `${tempFileTable} AS b `+ 
                `ON a.filePath = b.dirPath ` + 
                `GROUP by a.fileName `
            rows = await sqldb.allSync(sql);
            dirs = rows.map(e => e.filePath);
        }

        //-------------------files -----------------
        if(isRecursive){
            sql = `SELECT filePath FROM ${tempFileTable}`;
            rows = await sqldb.allSync(sql);
        }else{
            sql = `SELECT filePath FROM ${tempFileTable} WHERE dirPath = ?`;
            rows = await sqldb.allSync(sql, [dir]);
        }
        rows.forEach(obj => {
            const pp = obj.filePath;
            if (pp === dir) {
                return;
            }
            fileInfos[pp] = getFileToInfo(pp);
        })

        //---------------img folder -----------------
        const imgFolders = {};
        sql = `SELECT dirPath, group_concat(fileName, '${sep}') AS files ` +
            `FROM ${tempFileTable} WHERE isDisplayableInOnebook = true ` +
            `GROUP BY dirPath`;
        rows = await sqldb.allSync(sql);
        rows.forEach(row => {
            const pp = row.dirPath;
            if (pp === dir || !row.files) {
                return;
            }
            if(!isRecursive && !isDirectParent(dir, pp)){
                return;
            }
            const files =  row.files.split(sep);
            imgFolders[pp] = files.map(e => path.resolve(pp, e));
        })

        //-------------get extra info
        // time2 = getCurrentTime();
        // timeUsed = (time2 - time1) / 1000;
        // console.log("[/api/LsDir] sql time", timeUsed, "s")

        const imgFolderInfo = getImgFolderInfo(imgFolders);

        let result = {
            path: dir,
            dirs: dirs,
            fileInfos,
            imgFolderInfo,
            imgFolders
        };

        result = await _decorate(result);
        // const time3 = getCurrentTime();
        // timeUsed = (time3 - time2) / 1000;
        // console.log("[/api/LsDir] info look", timeUsed, "s")
        res.send(result);
    }catch(e){
        console.error(e);
        res.send({ failed: true, reason: e });
    }finally {
        //drop
        sql = `DROP TABLE IF EXISTS ${tempFileTable}`;
        sqldb.run(sql);
        sql = `DROP TABLE IF EXISTS ${tempDirTable}`
        sqldb.run(sql);
    }
});


async function listNoScanDir(filePath){
    let subFnArr = await readdir(filePath);
    let subFpArr = subFnArr.map(e => path.resolve(filePath, e));

    const compressFiles = subFpArr.filter(isCompress);
    const imageFiles = subFpArr.filter(isImage);
    const musicFiles = subFpArr.filter(isMusic);
    const videoFiles = subFpArr.filter(isVideo);
    const dirs = subFpArr.filter(e => {
        const ext = serverUtil.getExt(e);
        const isFolder = !ext;
        return isFolder;
    })

    const fileInfos = {};
    subFpArr.forEach(e => {
        fileInfos[e] = {};
    })

    const result = {
        path: filePath,
        mode: "lack_info_mode",

        stat: {},
        path: filePath,
        dirs,
        imgFolders: {},
        fileInfos,

        imageFiles,
        musicFiles, 
        videoFiles,
        compressFiles, 
    };
    result = await _decorate(result)
    return result;
}

router.post('/api/listImageFolderContent', async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const noMedataInfo = req.body && req.body.noMedataInfo;
    if (!filePath || !(await isExist(filePath))) {
        console.error("[/api/listImageFolderContent]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    let result;
    if(!isAlreadyScan(filePath)){
        result =  await listNoScanDir(filePath, res);
    }else{
        const sqldb = db.getSQLDB();
        let sql = `SELECT filePath FROM file_table WHERE INSTR(filePath, ?) = 1`;
        let _files = await sqldb.allSync(sql, [filePath]);

        _files = _files.map(e => e.filePath);
        // 单层或者递归，各有利弊，和其他地方逻辑一致吧
        _files = _files.filter(pp => {
            return isDirectParent(filePath, pp)
        });
    
        const imageFiles = _files.filter(isImage)
        const musicFiles = _files.filter(isMusic);
        const videoFiles = _files.filter(isVideo) 
    
        const mapping = {};
        mapping[filePath] = _files;
        const info = getImgFolderInfo(mapping)[filePath];
    
        result = {
            zipInfo: info,
            stat: info,
            path: filePath,
            imageFiles, musicFiles, videoFiles, 
        };
    }

    if(result && !noMedataInfo){
        result.mecab_tokens = await global.mecab_getTokens(filePath);
    }
    res.send(result);
    historyDb.addOneRecord(filePath);
});

module.exports = router;
