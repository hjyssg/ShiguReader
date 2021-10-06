const express = require('express');
const path = require('path');

const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const _ = require('underscore');
const isWindows = require('is-windows');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ini = require('ini');

global.requireUtil = () => require("../common/util");


global.requireUserConfig = () => require("../config/user-config");

global.requireConstant = () => require("../common/constant");

const execa = require('./own_execa');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();
const passwordConfig = require("../config/password-config");

const fileiterator = require('./file-iterator');
const pathUtil = require("./pathUtil");
const serverUtil = require("./serverUtil");
const { isHiddenFile, getHash, mkdir } = serverUtil;

const { generateContentUrl, isExist, getScanPath, isSub } = pathUtil;
const { isImage, isCompress, isVideo, isMusic, arraySlice,
    getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;

//set up path
const rootPath = pathUtil.getRootPath();
const { cache_folder_name, thumbnail_folder_name, view_img_folder } = userConfig
const cachePath = path.join(rootPath, cache_folder_name);
const thumbnailFolderPath = path.join(rootPath, thumbnail_folder_name);
global.thumbnailFolderPath = thumbnailFolderPath;
global.cachePath = cachePath;


const db = require("./models/db");
const {  deleteFromDb, getImgFolderInfo } = db;

const zipInfoDb = require("./models/zipInfoDb");
const thumbnailDb = require("./models/thumbnailDb");
const historyDb = require("./models/historyDb");
const cacheDb = require("./models/cacheDb");

//set up user path
const isDev = process.argv.includes("--dev");
const isProduction = !isDev;

// console.log("------path helper--------------");
// console.log("isProduction", isProduction)
// console.log("process.cwd()", process.cwd());
// console.log("__filename", __filename);
// console.log("__dirname", __dirname);
// console.log("rootPath", rootPath);
// console.log("----------------------");

const logger = require("./logger");
const searchByTagAndAuthor = require("./searchUtil");

const sevenZipHelp = require("./sevenZipHelp");
const { listZipContentAndUpdateDb, extractAll, extractByRange } = sevenZipHelp;


const app = express();
app.use(express.static('dist', {
    maxAge: (1000 * 3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000 * 3600 * 24).toString() // uses milliseconds per docs
}));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
// https://stackoverflow.com/questions/50304779/payloadtoolargeerror-request-entity-too-large?noredirect=1&lq=1
app.use(express.json({limit: '50mb'}));

var cookieParser = require('cookie-parser')
app.use(cookieParser())

const portConfig = require('../config/port-config');
const { http_port, dev_express_port } = portConfig;

// const jsonfile = require('jsonfile');
// let temp_json_path = path.join(rootPath, userConfig.workspace_name, "temp_json_info.json");


//read etc config
let etc_config = {};
try {
    let fcontent = fs.readFileSync(path.resolve(rootPath, "config-etc.ini"), 'utf-8');
    etc_config = ini.parse(fcontent);
    global.etc_config = etc_config;
} catch (e) {
    //nothing
    console.warn(e);
}

async function init() {
    if (isWindows()) {
        const { stdout, stderr } = await execa("chcp");
        // console.log("[chcp]", stdout);
        const r = new RegExp("\\d+");
        const m = r.exec(stdout);
        const charset = parseInt(m && m[0]);

        if (charset !== 65001) {
            console.error("I recommend you to change console encoding to utf8 in windows language setting");
        }

        global._cmd_encoding = charset;
    }

    if (isProduction) {
        const indexHtmlPath = path.resolve(rootPath, "dist", "index.html");
        // console.log(indexHtmlPath)
        if (!(await isExist(indexHtmlPath))) {
            console.error("[Error] No dist\\index.html for producation");
            console.error("[Error] You need to run npm run build");
            return;
        }
    }

    const port = isProduction ? http_port : dev_express_port;
    const server = app.listen(port, async () => {
        console.log("----------------------------------------------------------------");
        console.log(dateFormat(new Date(), "yyyy-mm-dd HH:MM"));
        console.log(`Express Server listening on port ${port}`);
        console.log("You can open ShiguReader from Browser now!");
        console.log(`http://localhost:${http_port}`);

        try {
            const internalIp = require('internal-ip');
            const lanIP = await internalIp.v4();
            const mobileAddress = `http://${lanIP}:${http_port}`;
            console.log(mobileAddress);
            console.log("Scan the QR code to open on mobile devices");
            qrcode.generate(mobileAddress);
        } catch (e) { }


        console.log("----------------------------------------------------------------");
        let { scan_path } = await getScanPath();
        //统一mkdir
        await mkdir(thumbnailFolderPath);
        await mkdir(cachePath);
        await mkdir(pathUtil.getImgConverterCachePath());
        await mkdir(pathUtil.getZipOutputCachePath());

        const mkdirArr = scan_path;
        for (let ii = 0; ii < mkdirArr.length; ii++) {
            const fp = mkdirArr[ii];
            if (!isWindows() && util.isWindowsPath(fp)) {
                continue;
            }
            await mkdir(fp, "quiet");
        }

        scan_path = await pathUtil.filterNonExist(scan_path);
        global.scan_path = scan_path;

        const cleanCache = require("../tools/cleanCache");
        cleanCache.cleanCache(cachePath);
        setUpCacheWatch();

        const mecabHelper = require("./mecabHelper");
        mecabHelper.init();

        let end1 = getCurrentTime();
        let thumbnail_pathes = await pfs.readdir(thumbnailFolderPath);
        thumbnail_pathes = thumbnail_pathes.filter(isImage).map(e => path.resolve(thumbnailFolderPath, e));
        let end3 = getCurrentTime();
        console.log(`[scan thumbnail] ${(end3 - end1) / 1000}s  to read thumbnail dirs`);
        thumbnailDb.init(thumbnail_pathes);

        let will_scan = _.sortBy(scan_path, e => e.length); //todo
        for (let ii = 0; ii < will_scan.length; ii++) {
            for (let jj = ii + 1; jj < will_scan.length; jj++) {
                const p1 = will_scan[ii];
                const p2 = will_scan[jj];

                if (pathUtil.isSub(p1, p2)) {
                    will_scan[jj] = "_to_remove_";
                }
            }
        }
        will_scan = will_scan.filter(e => e !== "_to_remove_");

        //todo: chokidar will slow the server down very much when it init async
        setUpFileWatch(will_scan);
    }).on('error', (error) => {
        logger.error("[Server Init]", error.message);
        //exit the current program
        process.exit(22);
    });
}


//this function which files will be scanned and watched by ShiguReader
function shouldWatchForNormal(p, stat) {
    //cache is cover by another watch
    if (p.includes(cachePath)) {
        return false;
    }

    if (isHiddenFile(p) || serverUtil.isForbid(p)) {
        return false;
    }

    //if ignore, chokidar wont check its content
    if (stat && stat.isDirectory()) {
        return true;
    }

    const ext = serverUtil.getExt(p);
    //not accurate, but performance is good. access each file is very slow
    const isFolder = !ext;
    let result = isFolder || isDisplayableInExplorer(ext);

    if (view_img_folder) {
        result = result || isDisplayableInOnebook(ext)
    }
    return result;
}

function shouldIgnoreForNormal(p, stat) {
    return !shouldWatchForNormal(p, stat);
}

function shouldIgnoreForCache(p, stat) {
    return !shouldWatchForCache(p, stat);
}

function shouldWatchForCache(p, stat) {
    if (isHiddenFile(p)) {
        return false;
    }

    //if ignore, chokidar wont check its content
    if (stat && stat.isDirectory()) {
        return true;
    }

    const ext = serverUtil.getExt(p);
    return !ext || isDisplayableInOnebook(ext) || isVideo(ext);
}

function setUpCacheWatch() {
    //also for cache files
    const cacheWatcher = chokidar.watch(cachePath, {
        ignored: shouldIgnoreForCache,
        persistent: true,
        ignorePermissionErrors: true,
        ignoreInitial: true,
    });

    cacheWatcher
        .on('add', (p, stats) => {
            cacheDb.updateStatToCacheDb(p, stats);
        })
        .on('unlink', p => {
            cacheDb.deleteFromCacheDb(p);
        });
}


let is_chokidar_ready = false;
const chokidar = require('chokidar');
function setUpFileWatch(scan_path) {
    console.log("[chokidar] begin...");
    let beg = getCurrentTime();

    //watch file change
    //update two database
    const watcher = chokidar.watch(scan_path, {
        ignored: shouldIgnoreForNormal,
        persistent: true,
        ignorePermissionErrors: true
    });

    let init_count = 0;

    const addCallBack = (fp, stats) => {
        serverUtil.parse(fp);
        db.updateStatToDb(fp, stats);
        if (is_chokidar_ready) {
            db.createSqlIndex();
        } else {
            init_count++;
            if (init_count % 2000 === 0) {
                let end1 = getCurrentTime();
                console.log(`[chokidar] scan: ${(end1 - beg) / 1000}s  ${init_count} ${fp}`);
            }
        }
    };

    const deleteCallBack = fp => {
        //todo: if folder removed
        //remove all its child
        deleteFromDb(fp);
        zipInfoDb.deleteFromZipDb(fp);
        //todo: delete thumbnail
    };

    watcher
        .on('add', addCallBack)
        .on('change', addCallBack)
        .on('unlink', deleteCallBack);

    // More possible events.
    watcher
        .on('addDir', addCallBack)
        .on('unlinkDir', deleteCallBack);

    //about 1s for 1000 files
    watcher.on('ready', () => {
        is_chokidar_ready = true;
        let end1 = getCurrentTime();
        console.log(`[chokidar] ${(end1 - beg) / 1000}s scan complete.`);
        console.log(`-------------------------------------------------`);
        console.log(`\n\n\n\n\n`);
    })

    return {
        watcher
    };
}


async function getThumbnailsForZip(filePathes) {
    const isStringInput = _.isString(filePathes);
    if (isStringInput) {
        filePathes = [filePathes];
    }

    const thumbnails = {};

    let end1 = getCurrentTime();
    let thumbArrs = thumbnailDb.getThumbnailArr(filePathes);
    thumbArrs.forEach(row => {
        thumbnails[row.filePath] = row.thumbnailFilePath;
    })
    let end3 = getCurrentTime();
    console.log(`[getThumbnailsForZip] ${(end3 - end1) / 1000}s for ${filePathes.length} zips`);

    filePathes.forEach(filePath => {
        if (thumbnails[filePath]) {
            return;
        }

        if (isCompress(filePath)) {
            //从cache找thumbnail意义不大
            //get cache file
            // const outputPath = path.join(cachePath, getHash(filePath));
            // let cacheFiles = cacheDb.getCacheFiles(outputPath);
            // cacheFiles = (cacheFiles && cacheFiles.files) || [];
            // let thumb = serverUtil.chooseThumbnailImage(cacheFiles);
            // if (thumb) {
            //     thumbnails[filePath] = thumb;
            // } else
            if (zipInfoDb.has(filePath)) {
                const pageNum = zipInfoDb.getZipInfo(filePath).pageNum;
                if (pageNum === 0) {
                    thumbnails[filePath] = "NOT_THUMBNAIL_AVAILABLE";
                }
            }
        }
    });

    if (isStringInput) {
        return thumbnails[filePathes[0]]
    }

    return thumbnails;
}

async function getThumbnailForFolders(filePathes) {
    const result = {};
    const sqldb = db.getSQLDB();

    let end1 = getCurrentTime();

    let promiseArr = filePathes.map(filePath => thumbnailDb.getThumbnailForFolder(filePath));
    let thumbnailRows = await Promise.all(promiseArr);

    for (let ii = 0; ii < filePathes.length; ii++) {
        const filePath = filePathes[ii];

        const ext = serverUtil.getExt(filePath);
        // console.assert(!ext);
        let rows = thumbnailRows[ii];
        if (rows && rows[0]) {
            result[filePath] = rows[0].thumbnailFilePath;
            continue;
        }

        let sql = `SELECT filePath FROM file_table WHERE INSTR(filePath, ?) > 0 AND isDisplayableInOnebook = true`;
        rows = await sqldb.allSync(sql, [filePath]);
        rows = rows.filter(row => {
            return isImage(row.filePath) && isSub(filePath, row.filePath);
        });
        if (rows.length > 0) {
            result[filePath] = rows[0].filePath;
        }
    }


    let end3 = getCurrentTime();
    console.log(`[getThumbnailForFolders] ${(end3 - end1) / 1000}s`);
    return result;
}

async function getStat(filePath) {
    const stat = await pfs.stat(filePath);
    if (isAlreadyScan(filePath)) {
        db.updateStatToDb(filePath, stat);
    }
    return stat;
}

function isAlreadyScan(dir) {
    return global.scan_path.some(sp => {
        return sp === dir || pathUtil.isSub(sp, dir);
    });
}

async function _decorate(resObj) {
    const { fileInfos, dirs, imgFolders } = resObj;
    console.assert(fileInfos && dirs && imgFolders);

    const files = _.keys(fileInfos);
    // const all_pathes = [].concat(files, _.keys(imgFolders));
    // let thumbnails = await getThumbnailsForZip(files);
    // let dirThumbnails = await getThumbnailForFolders(dirs);
    // const fileNameToReadTime = await historyDb.getFileReadTime(all_pathes);
    const [thumbnails] = await Promise.all([getThumbnailsForZip(files)]);
    resObj.zipInfo = zipInfoDb.getZipInfo(files);
    resObj.thumbnails = thumbnails;
    const imgFolderInfo = getImgFolderInfo(imgFolders);
    resObj.imgFolderInfo = imgFolderInfo;
    return resObj;
}


serverUtil.common._decorate = _decorate
serverUtil.common.getThumbnailsForZip = getThumbnailsForZip;
serverUtil.common.getStat = getStat;
serverUtil.common.isAlreadyScan = isAlreadyScan;

//--------------------
if (isProduction) {
    const history = require('connect-history-api-fallback');
    app.use(history({
        // verbose: true
    }));

    app.get('/index.html', (req, res) => {
        const as = path.resolve(rootPath, 'dist', 'index.html');
        res.sendFile(as);
    })
}

//---------login-----------

//TODO
// 疯狂发送请求洪水怎么处理
// 一个用户10秒最多100个请求？

const token_set = {};
app.post("/api/login", async (req, res) => {
    const password = req.body && req.body.password;
    if(password == passwordConfig.home_password){
        const token = serverUtil.makeid()
        token_set[token] = true;
        res.cookie('login-token', token, {maxAge: 1000 * 3600 * 24 })
        res.json({
            failed: false
        });
    }else{
        res.json({
            failed: true
        });
    }
})

app.post("/api/logout", async (req, res) => {
    if(req.cookies && req.cookies["login-token"] && token_set[req.cookies["login-token"]]){
        delete token_set[req.cookies["login-token"]]
    }
    res.cookie('login-token', "")
    res.send({ failed: false });
})


app.use((req, res, next) => {
    if(req.cookies && req.cookies["login-token"] && token_set[req.cookies["login-token"]]){
        next();
    }else{
        res.cookie('login-token', "")
        res.send({ failed: true, reason: "You need to login" });
    }
})

//-----------------thumbnail related-----------------------------------
app.post("/api/getThumbnailForFolders", async (req, res) => {
    const dirs = req.body && req.body.dirs;
    if (!dirs) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    const dirThumbnails = await getThumbnailForFolders(dirs);
    res.send({ failed: false, dirThumbnails });
});

app.post("/api/getFileReadTime", async (req, res) => {
    const all_pathes = req.body && req.body.all_pathes;
    if (!all_pathes) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    const fileNameToReadTime = await historyDb.getFileReadTime(all_pathes);
    res.send({ failed: false, fileNameToReadTime });
});

app.post("/api/tagFirstImagePath", async (req, res) => {
    const author = req.body && req.body.author;
    const tag = req.body && req.body.tag;
    if (!author && !tag) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    const onlyNeedFew = true;
    const { fileInfos } = await searchByTagAndAuthor(tag, author, null, onlyNeedFew);
    const files = _.keys(fileInfos);
    const chosendFileName = serverUtil.chooseOneZipForOneTag(files, db.getFileToInfo());
    if (!chosendFileName) {
        res.send({ failed: true, reason: "No file found" });
        return;
    }

    extractThumbnailFromZip(chosendFileName, res);
});

const thumbnailGenerator = require("../tools/thumbnailGenerator");
//the only required parameter is filePath
async function extractThumbnailFromZip(filePath, res, mode, config) {
    if (!util.isCompress(filePath)) {
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    const sendable = !isPregenerateMode && res;
    const outputPath = path.join(cachePath, getHash(filePath));
    let files;

    function sendImage(imgFp) {
        sendable && res.send({
            url: imgFp
        })
    }

    //do the extract
    try {
        //only update zip db
        //do not use zip db's information
        //in case previous info is changed or wrong
        if (isPregenerateMode) {
            if (config.fastUpdateMode && zipInfoDb.has(filePath)) {
                //skip
            } else {
                //in pregenerate mode, it always updates db content
                files = (await listZipContentAndUpdateDb(filePath)).files;
            }
        }

        const thumbnail = thumbnailDb.getThumbnailArr(filePath);
        if (thumbnail[0]) {
            sendImage(thumbnail[0].thumbnailFilePath);
        } else {
            if (!files) {
                files = (await listZipContentAndUpdateDb(filePath)).files;
            }
            const thumb = serverUtil.chooseThumbnailImage(files);
            if (!thumb) {
                throw "no img in this file";
            }
            const stderrForThumbnail = await extractByRange(filePath, outputPath, [thumb])
            if (stderrForThumbnail) {
                throw "extract exec failed";
            }
            // send original img path to client as thumbnail
            let original_thumb = path.join(outputPath, path.basename(thumb));
            sendImage(original_thumb);

            //compress into real thumbnail
            const outputFilePath = await thumbnailGenerator(thumbnailFolderPath, outputPath, path.basename(thumb));
            if (outputFilePath) {
                thumbnailDb.addNewThumbnail(filePath, outputFilePath);
            }
        }
    } catch (e) {
        console.error("[extractThumbnailFromZip] exception", filePath, e);
        const reason = e || "NOT FOUND";
        sendable && res.send({ failed: true, reason });
    }
}

//  a huge back ground task
//  it generate all thumbnail and will be slow
let pregenerateThumbnails_lock = false;
app.post('/api/pregenerateThumbnails', async (req, res) => {
    let path = req.body && req.body.path;
    if (!path) {
        res.send({ failed: true, reason: "NOT PATH" });
        return;
    } else if (pregenerateThumbnails_lock) {
        res.send({ failed: true, reason: "Already Running" });
        return;
    }

    pregenerateThumbnails_lock = true;
    const fastUpdateMode = req.body && req.body.fastUpdateMode;

    const allfiles = db.getAllFilePathes();
    let totalFiles = allfiles.filter(isCompress);
    if (path !== "All_Pathes") {
        totalFiles = totalFiles.filter(e => e.includes(path));
    }

    function shouldWatch(p, stat) {
        if (isHiddenFile(p)) {
            return false;
        }
        const ext = serverUtil.getExt(p);
        return !ext || isCompress(ext);
    }

    if (path && !isAlreadyScan(path)) {
        const { pathes } = await fileiterator(path, {
            doNotNeedInfo: true,
            filter: shouldWatch
        });
        totalFiles = pathes.filter(isCompress);
    }

    let config = {
        fastUpdateMode
    };

    const pregenBeginTime = getCurrentTime();
    const total = totalFiles.length;

    const thumbnailNum = await thumbnailDb.getThumbCount();
    if (thumbnailNum / totalFiles.length > 0.3) {
        totalFiles = _.shuffle(totalFiles);
    }

    res.send({ failed: false });


    console.log("begin pregenerateThumbnails")
    for (let ii = 0; ii < totalFiles.length; ii++) {
        try {
            const filePath = totalFiles[ii];
            await extractThumbnailFromZip(filePath, null, "pre-generate", config);
        } catch (e) {
            console.error(e);
        }
        const time2 = getCurrentTime();
        const timeUsed = (time2 - pregenBeginTime) / 1000;
        const secPerFile = timeUsed / ii;
        const remainTime = (total - ii) * secPerFile / 60;
        console.log(`[pre-generate minify] total: ${total}   ${(ii / total * 100).toFixed(2)}%    ${(secPerFile).toFixed(2)} sec/file    ${remainTime.toFixed(2)} mim left`);
    }

    pregenerateThumbnails_lock = false;
    console.log('[pregenerate] done');
});


//! !need to set windows console to utf8
app.post('/api/firstImage', async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }
    extractThumbnailFromZip(filePath, res);
});

async function getSameFileName(filePath) {
    if (!(await isExist(filePath))) {
        //maybe the file move to other location
        const fn = path.basename(filePath);
        const dir = path.dirname(filePath);

        const sqldb = db.getSQLDB();
        let sql = `SELECT filePath FROM file_table WHERE fileName LIKE ? AND filePath NOT LIke ? AND isCompress = true`;
        let rows = await sqldb.allSync(sql, [('%' + fn + '%'), (dir + '%')]);

        if (rows && rows.length > 1) {
            const tempP = pathUtil.getImgConverterCachePath();
            rows = rows.filter(e => {
                return !e.filePath.includes(tempP);
            })
        }
        let sameFnObj = rows && rows[0];

        if (sameFnObj) {
            filePath = sameFnObj.filePath;
            return filePath;
        } else {
            filePath = null;
        }
    }

    return filePath;
}

app.post('/api/extract', async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const startIndex = (req.body && req.body.startIndex) || 0;
    if (!filePath) {
        res.send({ failed: true, reason: "No parameter" });
        return;
    }

    //potential bug:
    // if in one zip there are 01/001.jpg and 01/002.jpg 
    // this will only only extract one, because they overwrite each other

    //todo: record the timestamp of each request
    //when cleaning cache, if the file is read recently, dont clean its cache
    filePath = await getSameFileName(filePath);
    if (!filePath) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    const time1 = getCurrentTime();
    const stat = await getStat(filePath);

    async function sendBack(contentObj, path, stat) {
        const { files, musicFiles, videoFiles } = contentObj

        const tempFiles = files.filter(e => {
            return !isHiddenFile(e);
        });
        let zipInfo;
        if (tempFiles.length > 0) {
            zipInfo = zipInfoDb.getZipInfo(path);
        }

        const mecab_tokens = await global.mecab_getTokens(path);

        res.send({ imageFiles: tempFiles, musicFiles, videoFiles, path, outputPath, stat, zipInfo, mecab_tokens });

        historyDb.addOneRecord(filePath)
    }

    const outputPath = path.join(cachePath, getHash(filePath));
    const temp = cacheDb.getCacheFiles(outputPath);

    if (zipInfoDb.has(filePath) && temp) {
        let tempZipInfo = zipInfoDb.getZipInfo(filePath);
        const totalNum = tempZipInfo.totalNum;
        const _files = temp.files || [];

        if (totalNum > 0 && _files.length >= totalNum) {
            sendBack(temp, filePath, stat);
            return;
        } else if (totalNum === 0) {
            sendBack({}, filePath, stat);
            return;
        }
    }

    (async () => {
        const full_extract_max = 10;
        try {
            let { files, fileInfos } = await listZipContentAndUpdateDb(filePath);
            let hasMusic = files.some(e => isMusic(e));
            let hasVideo = files.some(e => isVideo(e));
            files = files.filter(e => isDisplayableInOnebook(e));
            if (files.length === 0) {
                throw `${filePath} has no content`
            }

            //todo: music/video may be huge and will be slow
            if (hasMusic || hasVideo || files.length <= full_extract_max) {
                const { pathes, error } = await extractAll(filePath, outputPath);
                if (!error && pathes) {
                    const temp = generateContentUrl(pathes, outputPath);
                    sendBack(temp, filePath, stat);
                } else {
                    throw "fail to extract"
                }
            } else {
                //spit one zip into two uncompress task
                //so user can have a quicker response time
                serverUtil.sortFileNames(files);
                //choose range wisely
                const PREV_SPACE = 2;
                //cut the array into 3 parts
                let beg = startIndex - PREV_SPACE;
                let end = startIndex + full_extract_max - PREV_SPACE;
                const firstRange = arraySlice(files, beg, end);
                const secondRange = files.filter(e => {
                    return !firstRange.includes(e);
                })

                //dev checking
                if (firstRange.length + secondRange.length !== files.length) {
                    throw "arraySlice wrong";
                }

                let stderr = await extractByRange(filePath, outputPath, firstRange)
                if (!stderr) {
                    const temp = generateContentUrl(files, outputPath);
                    sendBack(temp, filePath, stat);
                    const time2 = getCurrentTime();
                    const timeUsed = (time2 - time1);
                    console.log(`[/api/extract] FIRST PART UNZIP ${filePath} : ${timeUsed}ms`);

                    await extractByRange(filePath, outputPath, secondRange)
                } else {
                    throw stderr;
                }
            }
        } catch (e) {
            res.send({ failed: true, reason: e });
            console.error('[/api/extract] exit: ', e);
        }
    })();
});

app.post('/api/getGeneralInfo', async (req, res) => {
    let os = isWindows() ? "windows" : "linux";

    const result = {
        server_os: os,
        file_path_sep: path.sep,
        has_magick: global._has_magick_,

        etc_config,

        good_folder: global.good_folder,
        not_good_folder: global.not_good_folder,
        additional_folder: global.scan_path
    };
    res.send(result)
});




const homePagePath = require("./routes/homePagePath");
app.use(homePagePath);

const getHistory = require("./routes/getHistory");
app.use(getHistory);

const lsdir = require("./routes/lsdir");
app.use(lsdir);

const getGoodAuthorNames = require("./routes/getGoodAuthorNames");
app.use(getGoodAuthorNames);

const moveOrDelete = require("./routes/moveOrDelete");
app.use(moveOrDelete);

// const download = require("./routes/download");
// app.use(download);

const search = require("./routes/search");
app.use(search);

const AllInfo = require("./routes/AllInfo");
app.use(AllInfo);

const singleFileInfo = require("./routes/singleFileInfo");
app.use(singleFileInfo);

const hentaiApi = require("./routes/hentaiApi");
app.use(hentaiApi);

const cleanCache = require("./routes/cleanCache");
app.use(cleanCache);

const CacheInfo = require("./routes/CacheInfo");
app.use(CacheInfo);

const shutdown = require("./routes/shutdown");
app.use(shutdown);

const minifyZip = require("./routes/minifyZip");
app.use(minifyZip);

// const ehentaiMetadata = require("./routes/ehentaiMetadata");
// app.use(ehentaiMetadata);

const fileServer = require("./fileServer");
fileServer.init();



init();

