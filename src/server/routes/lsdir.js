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
const zipInfoDb = require("../models/zipInfoDb");
const { getZipInfo } = zipInfoDb;
const { getThumbnails, isAlreadyScan } = serverUtil.common;
const _ = require('underscore');
const readdir = require("../readdir");
const stringHash = require("string-hash");
const historyDb = require("../models/historyDb");


router.post('/api/listFolderOnly', async (req, res) => {
    let dir = req.body && req.body.dir;

    if (!dir || !(await isExist(dir))) {
        console.error("[/api/lsDir]", dir, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    let pathes = await readdir(p, { withFileTypes: true });

    res.send({
        pathes
    });
});

//e.g http://localhost:3000/explorer/?p=F:\_Anime2
async function listNoScanDir(dir, res){
    // one level reading is about 1ms
    end1 = (new Date).getTime();

    // let pathes = await readdir(dir, { withFileTypes: true });  this crashes pkg when scan root folder
    let pathes = await readdir(dir);

    let _dirs = []; 
    const fileInfos = {};

    for (let ii = 0; ii < pathes.length; ii++) {
        const fp = path.join(dir, pathes[ii]);
        
        if(isCompress(fp) || isVideo(fp)){
            fileInfos[fp] = {};
        }else {
            const ext = serverUtil.getExt(fp);
            const isFolder = !ext;
            if(isFolder){
                _dirs.push(fp);
            }
        }
    }

    const dirThumbnails = {}
    const imgFolders = {};
    // const will_remove = {};
    // for(let ii = 0; ii < _dirs.length; ii++){
    //     const tempDir = _dirs[ii];
    //     try {
    //         let subArr = await readdir(tempDir, { withFileTypes: true });
    //         let subFnArr = subArr.filter(e => e.isFile()).map(e => e.name);
    //         let subFpArr = subFnArr.map(e => path.resolve(tempDir, e));

    //         const sub1 = subFpArr.filter(isDisplayableInOnebook);
    //         if(sub1.length > 0){
    //             imgFolders[tempDir] = sub1;
    //         } 

    //         dirThumbnails[tempDir] = getThumbnailForFolder(subFnArr , tempDir);

    //         //remove empty dir
    //         let subDirs = subArr.filter(e => e.isDirectory());
    //         let sub2 = subFpArr.filter(isDisplayableInExplorer);
    //         if(subDirs.length === 0 && sub2.length === 0){
    //             //going to remove 
    //             will_remove[tempDir] = true;
    //         }
    //     }catch(e){
    //         console.warn(e);
    //         will_remove[tempDir] = true;
    //     }
    // }
    // _dirs = _dirs.filter(e => !will_remove[e]);

    end3 = (new Date).getTime();
    console.log(`[listNoScanDir] ${(end3 - end1) / 1000}s `);

    const files = _.keys(fileInfos);
    const fileNameToReadTime = await historyDb.getFileReadTime(pathes);
    const  result = {
        path: dir,
        mode: "lack_info_mode",

        dirs: _dirs,
        fileInfos: fileInfos,

        // imgFolderInfo:  getImgFolderInfo(imgFolders),
        // imgFolders,

        thumbnails: getThumbnails(files),
        // dirThumbnails,
        zipInfo: getZipInfo(files),
        fileNameToReadTime
    };

    res.send(result);
}

function getThumbnailForFolder(files, dirPath){
    if(files && files.length > 0){
        serverUtil.sortFileNames(files);
        let thumbnail;
        let ii = 0;
        while(!thumbnail && ii < files.length){
            let tf = path.resolve(dirPath, files[ii]);

            if(isImage(tf)){
                thumbnail = tf;
                break;
            }

            thumbnail = getThumbnails(tf);
            ii++;
        }

        return thumbnail;
    }
}

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
        await listNoScanDir(dir, res);
        return;
    }

    const sqldb = db.getSQLDB();
    const suffix = stringHash(dir);
    const tempFileTable = "TEMP.FILE_TABLE_" + suffix;
    const tempDirTable = "TEMP.DIR_TABLE_" + suffix;

    try {
        const time1 = getCurrentTime();
        let time2, timeUsed;
        const dirThumbnails = {};
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
            rows.forEach(row => {
                if(!row.files){
                    return;
                }
                const dirPath = row.filePath;
                const files = row.files.split(sep);

                dirThumbnails[dirPath] = getThumbnailForFolder(files, dirPath)
            })
        }

        //-------------------files -----------------
        if(isRecursive){
            sql = `SELECT filePath FROM ${tempFileTable} WHERE isDisplayableInExplorer = true`;
            rows = await sqldb.allSync(sql);
        }else{
            sql = `SELECT filePath FROM ${tempFileTable} WHERE dirPath = ? AND isDisplayableInExplorer = true`;
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
        const files = _.keys(fileInfos);
        const all_pathes = [].concat(files, _.keys(imgFolders));
        const fileNameToReadTime = await historyDb.getFileReadTime(all_pathes);
        
        const result = {
            path: dir,
            dirs: dirs,
            fileInfos,
            imgFolderInfo,
            imgFolders,
            thumbnails: getThumbnails(files),
            dirThumbnails,
            zipInfo: getZipInfo(files),
            fileNameToReadTime
        };

        // const time3 = getCurrentTime();
        // timeUsed = (time3 - time2) / 1000;
        // console.log("[/api/LsDir] info look", timeUsed, "s")
        res.send(result);
    }catch(e){

    }finally {
        //drop
        sql = `DROP TABLE IF EXISTS ${tempFileTable}`;
        sqldb.run(sql);
        sql = `DROP TABLE IF EXISTS ${tempDirTable}`
        sqldb.run(sql);
    }
});

async function listUnscaneImageFolderContent(filePath, res){
    let subFnArr = await readdir(filePath);
    let subFpArr = subFnArr.map(e => path.resolve(filePath, e));

    const files = subFpArr.filter(isImage);
    const musicFiles = subFpArr.filter(isMusic);
    const videoFiles = subFpArr.filter(isVideo);

    const result = {
        zipInfo: {},
        stat: {},
        path: filePath,
        files,
        musicFiles, 
        videoFiles
    };
    res.send(result)
    historyDb.addOneRecord(filePath);
}

router.post('/api/listImageFolderContent', async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const noMedataInfo = req.body && req.body.noMedataInfo;
    if (!filePath || !(await isExist(filePath))) {
        console.error("[/api/listImageFolderContent]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if(!isAlreadyScan(filePath)){
        await listUnscaneImageFolderContent(filePath, res);
        return;
    }

    let result;
    const sqldb = db.getSQLDB();
    let sql = `SELECT filePath FROM file_table WHERE INSTR(filePath, ?) = 1`;
    let _files = await sqldb.allSync(sql, [filePath]);
    _files = _files.map(e => e.filePath);
    
    // forEach(e => {
    //     const pp = e.filePath;
    //     if (isDirectParent(filePath, pp)) {
    //         _files.push(pp);
    //     }
    // });

    const files = _files.filter(isImage)
    const musicFiles = _files.filter(isMusic);
    const videoFiles = _files.filter(isVideo) 

    const mapping = {};
    mapping[filePath] = _files;

    let info, mecab_tokens;
    if(!noMedataInfo){
        info = getImgFolderInfo(mapping)[filePath];
        mecab_tokens = await global.mecab_getTokens(filePath);
    }

    //ugly code here
    result = {
        zipInfo: info,
        stat: info,
        path: filePath,
        files, musicFiles, videoFiles, mecab_tokens
    };
    res.send(result);
    historyDb.addOneRecord(filePath);
});

module.exports = router;
