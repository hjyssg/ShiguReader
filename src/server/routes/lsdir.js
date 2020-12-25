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
const { getThumbnails } = serverUtil.common;
const _ = require('underscore');
const readdir = require("../readdir");


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

    const imgFolders = {};
    const will_remove = {};
    for(let ii = 0; ii < _dirs.length; ii++){
        const tempDir = _dirs[ii];
        try {
            let subArr = await readdir(tempDir, { withFileTypes: true });
            let subFnArr = subArr.filter(e => e.isFile()).map(e => e.name);
            let subFpArr = subFnArr.map(e => path.resolve(tempDir, e));

            const sub1 = subFpArr.filter(isDisplayableInOnebook);
            if(sub1.length > 0){
                imgFolders[tempDir] = sub1;
            } 

            let subDirs = subArr.filter(e => e.isDirectory());
            let sub2 = subFpArr.filter(isDisplayableInExplorer);
            if(subDirs.length === 0 && sub2.length === 0){
                //going to remove 
                will_remove[tempDir] = true;
            }
        }catch(e){
            console.warn(e);
            will_remove[tempDir] = true;
        }
    }

    _dirs = _dirs.filter(e => !will_remove[e]);

    end3 = (new Date).getTime();
    console.log(`[listNoScanDir] ${(end3 - end1) / 1000}s `);

    const files = _.keys(fileInfos);
    const  result = {
        path: dir,
        mode: "lack_info_mode",

        dirs: _dirs,
        fileInfos: fileInfos,

        imgFolderInfo: {},
        imgFolders,

        thumbnails: getThumbnails(files),
        dirThumbnails: {},
        zipInfo: getZipInfo(files),
    };

    res.send(result);
}

function isAlreadyScan(dir){
    return global.scan_path.some(sp => {
        return sp === dir || isSub(sp, dir);
    });
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

    const time1 = getCurrentTime();
    let result;
    const dirs = [];
    let fileInfos = {};
    const pTokens = dir.split(path.sep);
    const plength = pTokens.length;

    const sqldb = db.getSQLDB();
    let sql = `SELECT * FROM file_table WHERE filePath LIKE ? AND isDisplayableInExplorer = ?`;
    let rows = await sqldb.allSync(sql, [(dir+ '%'), true]);
    rows = rows.filter(obj => isSub(dir, obj.filePath));

    //dir -> its file
    const dirToFiles = {};

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

        return np;
    }

    rows.forEach(obj => {
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
                const np = addParent(pp);
                dirToFiles[np] = dirToFiles[np] || [];
                dirToFiles[np].push(pp);
            }
        }
    })

    let sql2 = `SELECT * FROM file_table WHERE filePath LIKE ? AND isDisplayableInOnebook = ?`;
    let img_files_rows = await sqldb.allSync(sql2, [(dir+ '%'), true]);
    img_files_rows = img_files_rows.filter(obj => isSub(dir, obj.filePath));

    const imgFolders = {};

    img_files_rows.forEach(obj => {
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
                const np = addParent(pp);
                dirToFiles[np] = dirToFiles[np] || [];
                dirToFiles[np].push(obj.filePath);
            }
        }
    })

    const imgFolderInfo = getImgFolderInfo(imgFolders);

    const time2 = getCurrentTime();
    const timeUsed = (time2 - time1) / 1000;
    console.log(timeUsed, "to LsDir")

    const files = _.keys(fileInfos);
    const _dirs = _.uniq(dirs);


    const dirThumbnails = {};
    _dirs.map(dirPath => {
        const files = dirToFiles[dirPath];
        serverUtil.sortFileNames(files);
        //todo? use 0 for now
        if(files && files.length > 0){
            let thumbnail;
            let ii = 0;
            while(!thumbnail && ii < files.length){
                let tf = files[ii];

                if(isImage(tf)){
                    thumbnail = tf;
                    break;
                }

                thumbnail = getThumbnails(tf);
                ii++;
            }
            if(thumbnail){
                dirThumbnails[dirPath] =  thumbnail;
            }
        }
    })

    result = {
        path: dir,
        dirs: _dirs,
        fileInfos,
        imgFolderInfo,
        imgFolders,
        thumbnails: getThumbnails(files),
        dirThumbnails,
        zipInfo: getZipInfo(files),
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

    if(!isAlreadyScan(filePath)){
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
        return;
    }

    let result;
    const sqldb = db.getSQLDB();
    let sql = `SELECT * FROM file_table WHERE filePath LIKE ? AND isDisplayableInOnebook = ?`;
    let fake_zip_results = await sqldb.allSync(sql, [(filePath+ '%'), true]);

    const _files = [];

    fake_zip_results.forEach(e => {
        const pp = e.filePath;
        if (isDirectParent(filePath, pp)) {
            _files.push(pp);
        }
    });

    const files = _files.filter(isImage)
    const musicFiles = _files.filter(isMusic);
    const videoFiles = _files.filter(isVideo) 

    const mapping = {};
    mapping[filePath] = _files;
    const info = getImgFolderInfo(mapping)[filePath];

    //ugly code here
    result = {
        zipInfo: info,
        stat: info,
        path: filePath,
        files, musicFiles, videoFiles
    };
    res.send(result);
});

module.exports = router;
