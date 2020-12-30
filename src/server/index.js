const express = require('express');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const _ = require('underscore');
const isWindows = require('is-windows');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const ini = require('ini');

global.requireUtil = function (e) {
    return require("../common/util")
};

global.requireUserConfig = function () {
    return require("../config/user-config")
};

global.requireConstant = function () {
    return require("../common/constant");
}

const userConfig = global.requireUserConfig();
const util = global.requireUtil();

const fileiterator = require('./file-iterator');
const pathUtil = require("./pathUtil");
const serverUtil = require("./serverUtil");
const { isHiddenFile } = serverUtil;

const { fullPathToUrl, generateContentUrl, isExist, getScanPath } = pathUtil;
const { isImage, isCompress, isVideo, isMusic, arraySlice,
    getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook, escapeRegExp } = util;

//set up path
const rootPath = pathUtil.getRootPath();
const { cache_folder_name, thumbnail_folder_name, view_img_folder } = userConfig
const cachePath = path.join(rootPath, cache_folder_name);
const thumbnailFolderPath = path.join(rootPath, thumbnail_folder_name);
global.cachePath = cachePath;


//set up user path

const isDev = process.argv.includes("--dev");
const isProduction =!isDev;

console.log("------path helper--------------");
console.log("isProduction", isProduction)
console.log("process.cwd()", process.cwd());
console.log("__filename", __filename);
console.log("__dirname", __dirname);
console.log("rootPath", rootPath);
console.log("----------------------");

const logger = require("./logger");

const searchByTagAndAuthor = require("./models/searchUtil");


//set up json DB
const zipInfoDb = require("./models/zipInfoDb");
let zip_content_db_path = path.join(rootPath, userConfig.workspace_name, "zip_info");
zipInfoDb.init(zip_content_db_path);
const { getPageNum, getMusicNum, deleteFromZipDb, getZipInfo } = zipInfoDb;


const sevenZipHelp = require("./sevenZipHelp");
const { listZipContentAndUpdateDb, extractAll, extractByRange } = sevenZipHelp;

const db = require("./models/db");
const { getAllFilePathes, getCacheFiles, getCacheOutputPath,
    updateStatToDb, deleteFromDb, updateStatToCacheDb, deleteFromCacheDb } = db;

const app = express();
app.use(express.static('dist', {
    maxAge: (1000 * 3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000 * 3600 * 24).toString() // uses milliseconds per docs
}));
//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

const portConfig = require('../config/port-config');
const { http_port, dev_express_port } = portConfig;

let thumbnailDb = {};

const jsonfile = require('jsonfile');
let temp_json_path = path.join(rootPath, userConfig.workspace_name, "temp_json_info.json");


async function mkdir(path, quiet) {
    if (path && !(await isExist(path))) {
        try {
            const err = await pfs.mkdir(path, { recursive: true });
            if (err instanceof Error) {
                throw err;
            }
        } catch (err) {
            if (!quiet) {
                throw err;
            }
        }
    }
}


//read etc config
let etc_config = {};
try{
    let fcontent = fs.readFileSync(path.resolve(rootPath, "etc-config.ini"), 'utf-8');
    etc_config = ini.parse(fcontent);
}catch(e){
    //nothing
    console.warn(e);
}

async function init() {
    if (isWindows()) {
        const { stdout, stderr } = await execa("chcp");
        console.log("[chcp]", stdout);
        const r = new RegExp("\\d+");
        const m = r.exec(stdout);
        const charset = parseInt(m && m[0]);

        if (charset !== 65001) {
            console.error("Please switch you console encoding to utf8 in windows language setting");
            userConfig.readable_cache_folder_name = false;
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
        } catch (e) {  }


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
            await mkdir(fp, "quiet");
        }
    
        scan_path = await pathUtil.filterNonExist(scan_path);
        global.scan_path = scan_path;
    
        const cleanCache = require("../tools/cleanCache");
        cleanCache.cleanCache(cachePath);
        setUpCacheWatch();

        initMecab();
    
        end1 = (new Date).getTime();
        let thumbnail_pathes = await pfs.readdir(thumbnailFolderPath);
        thumbnail_pathes = thumbnail_pathes.filter(isImage).map(e => path.resolve(thumbnailFolderPath, e));
        end3 = (new Date).getTime();
        console.log(`[scan thumbnail] ${(end3 - end1) / 1000}s  to read thumbnail dirs`);
        initThumbnailDb(thumbnail_pathes);
    
        let will_scan = _.sortBy(scan_path, e => e.length); //todo
        for(let ii = 0; ii < will_scan.length; ii++){
            for(let jj = ii+1; jj < will_scan.length; jj++){
                const p1 = will_scan[ii];
                const p2 = will_scan[jj];
    
                if(pathUtil.isSub(p1, p2)){
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

function addToThumbnailDb(filePath) {
    const key = path.basename(filePath, path.extname(filePath));
    thumbnailDb[key] = filePath;
}

function initThumbnailDb(filePath) {
    filePath.forEach(e => {
        addToThumbnailDb(e);
    })
}

function getThumbnailFromThumbnailFolder(outputPath) {
    const key = path.basename(outputPath);
    return thumbnailDb[key];
}

function getThumbCount() {
    return _.keys(thumbnailDb).length;
}

global.getThumbCount = getThumbCount;

const junk = require('junk');

const forbid = ["System Volume Information", 
                "$Recycle.Bin", 
                "Config.Msi", 
                "$WinREAgent", 
                "Windows", 
                "msdownld.tmp",
                "node_modules"];
function isForbid(str){
    str = str.toLocaleLowerCase();
    return forbid.some(e => {
        return  path.basename(str) === e.toLocaleLowerCase();
    });
}

//this function which files will be scanned and watched by ShiguReader
function shouldWatchForNormal(p, stat) {
    //cache is cover by another watch
    if(p.includes(cachePath)){
        return false;
    }

    if (isHiddenFile(p) || junk.is(p) || isForbid(p)) {
        return false;   
    }

    //if ignore, chokidar wont check its content
    if(stat && stat.isDirectory()){
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
    if(stat && stat.isDirectory()){
        return true;
    }

    const ext = serverUtil.getExt(p);
    return !ext || isDisplayableInOnebook(ext) || isVideo(ext);
}

function setUpCacheWatch(){
        //also for cache files
        const cacheWatcher = chokidar.watch(cachePath, {
            ignored: shouldIgnoreForCache,
            persistent: true,
            ignorePermissionErrors: true,
            ignoreInitial: true,
        });
    
        cacheWatcher
            .on('unlinkDir', p => {
                //todo 
                const fp = path.dirname(p);
                db.cacheDb.folderToFiles[fp];
            });
    
        cacheWatcher
            .on('add', (p, stats) => {
                updateStatToCacheDb(p, stats);
            })
            .on('unlink', p => {
                deleteFromCacheDb(p);
            });
}


let is_chokidar_ready = false;
const chokidar = require('chokidar');
function setUpFileWatch(scan_path) {
    console.log("[chokidar] begin...");
    let beg = (new Date).getTime();

    //watch file change 
    //update two database
    const watcher = chokidar.watch(scan_path, {
        ignored: shouldIgnoreForNormal,
        persistent: true,
        ignorePermissionErrors: true
    });

    let init_count = 0;

    const addCallBack = (path, stats) => {
        serverUtil.parse(path);
        updateStatToDb(path, stats);

        if(is_chokidar_ready){
            // no very useful
            // if (isCompress(path) && stats.size > 1 * 1024 * 1024) {
            //     //do it slowly to avoid the file used by the other process
            //     //this way is cheap than the really detection
            //     setTimeout(() => {
            //         listZipContentAndUpdateDb(path);
            //     }, 3000);
            // }
        }else{
            init_count++;
            if (init_count % 2000 === 0) {
                let end1 = (new Date).getTime();
                console.log(`[chokidar] scan: ${(end1 - beg) / 1000}s  ${init_count} ${path}` );
            }
        }
    };

    const deleteCallBack = path => {
        //todo: if folder removed
        //remove all its child
        deleteFromDb(path);
        deleteFromZipDb(path);
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
        let end1 = (new Date).getTime();
        console.log(`[chokidar] ${(end1 - beg) / 1000}s scan complete.`);
        console.log(`-------------------------------------------------`);
        console.log(`\n\n\n\n\n`);
    })

    return {
        watcher
    };
}

async function initMecab() {
    let parseAsync;
    try {
        const MeCab = require('mecab-async');
        const mecab = new MeCab();
        const _util = require('util');
        parseAsync = _util.promisify(mecab.parse).bind(mecab);
        const testTokens = await parseAsync("うちの娘の為ならば、俺はもしかしたら魔王も倒せるかもしれない");
    } catch (e) {
        parseAsync = null;
    }

    global.mecab_getTokens = async (str) => {
        let result = [];
        try {
            if (parseAsync) {
                //pre-processing of the str
                str = path.basename(str, path.extname(str));
                let pObj = serverUtil.parse(str);
                if (pObj && pObj.title) {
                    str = pObj.title;
                }

                //do the Mecab
                let tokens = await parseAsync(str);
                // console.log(tokens);

                //handle the tokens
                tokens = tokens
                    .filter(row => {
                        return ["名詞", "動詞"].includes(row[1]);
                    })
                    .map(row => row[0]);

                //[apple, c, b, k, llll, p, p, p] 
                // => 
                // [apple, cbk, llll, ppp] 
                let acToken = "";
                const len = tokens.length;
                let ii = 0;
                while (ii < len) {
                    let tempToken = tokens[ii];
                    if (tempToken.length > 1) {
                        if (acToken.length > 1) {
                            result.push(acToken);
                        }
                        result.push(tempToken)
                        acToken = "";
                    } else if (tempToken.length === 1) {
                        acToken += tempToken;
                    }
                    ii++;
                }
                //the last token
                if (acToken.length > 1) {
                    result.push(acToken);
                }
            }
        } catch (e) {
            console.warn(e);
        } finally {
            return result;
        }
    }
}


function getThumbnails(filePathes) {
    const stringInput = _.isString(filePathes);
    if(stringInput){
        filePathes = [filePathes];
    }

    const thumbnails = {};

    filePathes.forEach(filePath => {
        if (!isCompress(filePath)) {
            return;
        }

        const outputPath = getCacheOutputPath(cachePath, filePath);
        let thumb = getThumbnailFromThumbnailFolder(outputPath);
        if (thumb) {
            thumbnails[filePath] = fullPathToUrl(thumb);
        } else {
            let cacheFiles = getCacheFiles(outputPath);
            cacheFiles = (cacheFiles && cacheFiles.files) || [];
            thumb = serverUtil.chooseThumbnailImage(cacheFiles);
            if (thumb) {
                thumbnails[filePath] = fullPathToUrl(thumb);
            } else if (zipInfoDb.has(filePath)) {
                const pageNum = getPageNum(filePath);
                if (pageNum === 0) {
                    thumbnails[filePath] = "NOT_THUMBNAIL_AVAILABLE";
                }
            }
        }
    });

    if(stringInput){
        return thumbnails[filePathes[0]]
    }

    return thumbnails;
}

async function getStat(filePath) {
    const stat = await pfs.stat(filePath);
    updateStatToDb(filePath, stat);
    return stat;
}


serverUtil.common.getCacheOutputPath = getCacheOutputPath;
serverUtil.common.getThumbnails = getThumbnails;
serverUtil.common.getStat = getStat;

//-----------------thumbnail related-----------------------------------

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
    chosendFileName = serverUtil.chooseOneZipForOneTag(files, db.getFileToInfo());
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
    const outputPath = getCacheOutputPath(cachePath, filePath);
    let files;

    function sendImage(img) {
        sendable && res.send({
            url: fullPathToUrl(img)
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

        const thumbnail = getThumbnailFromThumbnailFolder(outputPath);
        if (thumbnail) {
            sendImage(thumbnail);
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
            // send path to client
            let original_thumb = path.join(outputPath, path.basename(thumb));
            sendImage(original_thumb);
            const outputFilePath = await thumbnailGenerator(thumbnailFolderPath, outputPath, path.basename(thumb));
            if (outputFilePath) {
                addToThumbnailDb(outputFilePath);
            }
        }
    } catch (e) {
        console.error("[extractThumbnailFromZip] exception", filePath, e);
        const reason = e || "NOT FOUND";
        sendable && res.send({ failed: true, reason: reason });
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

    const allfiles = getAllFilePathes();
    let totalFiles = allfiles.filter(isCompress);
    if (path !== "All_Pathes") {
        totalFiles = totalFiles.filter(e => e.includes(path));
    }

    let config = {
        fastUpdateMode
    };

    const pregenBeginTime = getCurrentTime();
    const total = totalFiles.length;

    const thumbnailNum = getThumbCount();
    if (thumbnailNum / totalFiles.length > 0.3) {
        totalFiles = _.shuffle(totalFiles);
    }

    res.send({ failed: false });

    try {
        console.log("begin pregenerateThumbnails")
        for (let ii = 0; ii < totalFiles.length; ii++) {
            const filePath = totalFiles[ii];
            await extractThumbnailFromZip(filePath, null, "pre-generate", config);
            const time2 = getCurrentTime();
            const timeUsed = (time2 - pregenBeginTime) / 1000;
            const secPerFile = timeUsed / ii;
            const remainTime = (total - ii) * secPerFile / 60;
            console.log(`[pre-generate minify] total: ${total}   ${(ii/total*100).toFixed(2)}%    ${(secPerFile).toFixed(2)} sec/file    ${remainTime.toFixed(2)} mim left`);
        }
    } catch (e) {

    } finally {
        pregenerateThumbnails_lock = false;
        console.log('[pregenerate] done');
    }
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

async function getSameFileName(filePath){
    if (!(await isExist(filePath))) {
        //maybe the file move to other location
        const fn = path.basename(filePath);
        const dir = path.dirname(filePath);

        const sqldb = db.getSQLDB();
        let sql = `SELECT * FROM file_table WHERE fileName LIKE ? AND filePath NOT LIke ? AND isCompress = ?`;
        let rows = await sqldb.allSync(sql, [( '%' + fn + '%'), (dir + '%'), true]);
        sameFnObj = rows && rows[0];

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
    if (!filePath){
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    const time1 = getCurrentTime();
    const stat = await getStat(filePath);

    async function sendBack(contentObj, path, stat) {
        const {files, musicFiles, videoFiles } = contentObj

        const tempFiles = files.filter(e => {
            return !isHiddenFile(e);
        });
        let zipInfo;
        if (tempFiles.length > 0) {
            zipInfo = getZipInfo([path])[path];
        }

        const mecab_tokens = await global.mecab_getTokens(path);

        res.send({ files: tempFiles, musicFiles, videoFiles, path, stat, zipInfo, mecab_tokens });
    }

    const outputPath = getCacheOutputPath(cachePath, filePath);
    const temp = getCacheFiles(outputPath);

    if (zipInfoDb.has(filePath) && temp) {
        const pageNum = getPageNum(filePath);
        const musicNum = getMusicNum(filePath);
        const totalNum = pageNum + musicNum;
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

        etc_config: etc_config,

        good_folder: global.good_folder,
        not_good_folder: global.not_good_folder,
        additional_folder: global.scan_path
    };
    res.send(result)
});


//---------------------------
const homePagePath = require("./routes/homePagePath");
app.use(homePagePath);

const lsdir = require("./routes/lsdir");
app.use(lsdir);

const getGoodAuthorNames = require("./routes/getGoodAuthorNames");
app.use(getGoodAuthorNames);

const moveOrDelete = require("./routes/moveOrDelete");
app.use(moveOrDelete);

const download = require("./routes/download");
app.use(download);

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

const ehentaiMetadata = require("./routes/ehentaiMetadata");
app.use(ehentaiMetadata);


if (isProduction) {
    const history = require('connect-history-api-fallback');
    app.use(history({
        verbose: true
    }));

    app.get('/index.html', (req, res) => {
        const as = path.resolve(rootPath, 'dist', 'index.html');
        res.sendFile(as);
    })
}

init();
