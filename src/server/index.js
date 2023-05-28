const path = require('path');
const fs = require('fs');
const express = require('express');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const _ = require('underscore');
const qrcode = require('qrcode-terminal');
const ini = require('ini');
const memorycache = require('memory-cache');
const chokidar = require('chokidar');
const { pathEqual } = require('path-equal');


global.isWindows = require('is-windows')();
global.requireUtil = () => require("../common/util");
global.requireUserConfig = () => require("../config/user-config");
global.requireConstant = () => require("../common/constant");

const execa = require('./own_execa');
const userConfig = global.requireUserConfig();
const util = global.requireUtil();

const fileiterator = require('./file-iterator');
const pathUtil = require("./pathUtil");
pathUtil.init();
const serverUtil = require("./serverUtil");
const { getHash, mkdir, mkdirSync, asyncWrapper } = serverUtil;

const { isHiddenFile, generateContentUrl, isExist, filterPathConfig, isSub, estimateIfFolder } = pathUtil;
const { isImage, isCompress, isVideo, isMusic, arraySlice,
    getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;

//set up path
const rootPath = pathUtil.getRootPath();
const { cache_folder_name, thumbnail_folder_name, view_img_folder } = userConfig
const cachePath = path.join(rootPath, cache_folder_name);
const thumbnailFolderPath = path.join(rootPath, thumbnail_folder_name);
global.thumbnailFolderPath = thumbnailFolderPath;
global.cachePath = cachePath;
const indexHtmlPath = path.resolve(rootPath, "dist", "index.html");
const bundleJsPath = path.resolve(rootPath, "dist", "bundle.js");
const distPath = path.resolve(rootPath, "dist");
const etf_config_path = path.resolve(rootPath, "config-etc.ini");
const path_config_path = path.join(rootPath, "config-path.ini");
const workspacePath = pathUtil.getWorkSpacePath();
console.log("------path debug-----------------------------------------------");
console.log("__filename:         ", __filename);
console.log("__dirname:          ", __dirname);
console.log("process.execPath:   ", process.execPath);
console.log("process.cwd():      ", process.cwd());
console.log("global.isPkg:       ", global.isPkg)
console.log("rootPath:           ", rootPath);
console.log("distPath:           ", distPath);
console.log("indexHtmlPath:      ", indexHtmlPath);
console.log("bundleJsPath:       ", bundleJsPath);
console.log("etf_config_path:    ", etf_config_path);
console.log("path_config_path:   ", path_config_path);
console.log("workspacePath:      ", workspacePath);
console.log("----------------------------------------------------------------");

// 会被监视扫描的文件夹、现在既存在global也存在db。之前想做分布式server，但又算了。
global.SCANED_PATH = [];

// mkdir
mkdirSync(workspacePath);
mkdirSync(thumbnailFolderPath);
mkdirSync(cachePath);
mkdirSync(pathUtil.getImgConverterCachePath());
mkdirSync(pathUtil.getZipOutputCachePath());

const logger = require("./logger");
logger.init();
const { searchByTagAndAuthor } = require("./searchUtil");

const sevenZipHelp = require("./sevenZipHelp");
sevenZipHelp.init();
const { listZipContentAndUpdateDb, extractAll, extractByRange } = sevenZipHelp;

// 从用户命令拿port和其他参数
const portConfig = require('../config/port-config');
const { program } = require('commander');
program
    .option('-p, --port <number>', 'Specify the port',  portConfig.default_http_port)
    .option('--skip-scan', 'skip initial scan for startup fasted', false)
    .option('--skip-cache-clean', 'skip initial cache clean', false);
program.parse(process.argv);
const options = program.opts();
const port = _.isString(options.port)? parseInt(options.port): options.port; // 懒得细看commander，不是最正确写法
const skipScan = options.skipScan;
const skipCacheClean = options.skipCacheClean;
console.log("port: ", port);
console.log("skipScan: ", skipScan);
console.log("skipCacheClean: ", skipCacheClean);



// DB import
const db = require("./models/db");
const zipInfoDb = require("./models/zipInfoDb");
const thumbnailDb = require("./models/thumbnailDb");
const historyDb = require("./models/historyDb");
const cacheDb = require("./models/cacheDb");


const app = express();

// express的静态文件middle ware，但有时不好使。还需要staticFileRouter()
app.use(express.static(distPath, {
    maxAge: (1000 * 3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000 * 3600).toString() // uses milliseconds per docs
}));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
// https://stackoverflow.com/questions/50304779/payloadtoolargeerror-request-entity-too-large?noredirect=1&lq=1
app.use(express.json({limit: '50mb'}));

const cookieParser = require('cookie-parser')
app.use(cookieParser())

//read etc config
let etc_config = {};
let path_config;
try {
    // console.log("read ini....")
    let fcontent = fs.readFileSync(etf_config_path, 'utf-8');
    etc_config = ini.parse(fcontent);
    global.etc_config = etc_config;
    // console.log(etf_config_path);

    const fContent1 = fs.readFileSync(path_config_path).toString();
    path_config = ini.parse(fContent1);
    // console.log("read done ")
    // console.log(path_config_path);
} catch (e) {
    //nothing
    logger.warn("fail to read ini files")
    logger.warn(e);
}

const internalIp = require('internal-ip');
async function getIP(){
    const lanIP = await internalIp.v4();
    const mobileAddress = `http://${lanIP}:${port}`;
    return mobileAddress;
}

const cleanCache = require("./cleanCache");

try {
    // 因为sharp在pkg用不了，灵活的逻辑
    global.sharp = require('sharp')
} catch (e) {
    // 有image magick也行
    logger.warn("[Warning] Did not install sharp");
    logger.warn(e);
    logger.warn("----------------------------------------------------------------");
}

async function init() {
    if (global.isWindows) {
        const { stdout, stderr } = await execa("chcp");
        // console.log("[chcp]", stdout);
        const r = new RegExp("\\d+");
        const m = r.exec(stdout);
        const charset = parseInt(m && m[0]);

        if (charset !== 65001) {
            logger.error("Changing console encoding to utf8 in Windows language setting is recommended");
        }

        global._cmd_encoding = charset;
    }

    // console.log(indexHtmlPath)
    if (!(await isExist(indexHtmlPath))) {
        logger.warn(`[Error] No ${indexHtmlPath} for producation`);
        logger.warn("[Error] You may need to run npm run build");
    }

    await db.init();
    await thumbnailDb.init();
    await historyDb.init();
    await zipInfoDb.init();
    
    //express does not check if the port is used and remains slient
    // we need to check
    const isPortOccupied =  await serverUtil.isPortOccupied(port);
    if(isPortOccupied){
        logger.error(`[Server Init] port ${port} is occupied `);
        await serverUtil.suspend();
        process.exit(22);
    }

    const server = app.listen(port, async () => {
        const filterPathConfigObj = await filterPathConfig(path_config, skipScan);
        global = {
            ...global,
            ...filterPathConfigObj
        };
        let scan_path = filterPathConfigObj.scan_path;
        serverUtil.mkdirList(scan_path)
        scan_path = await pathUtil.filterNonExist(scan_path);

        global.SCANED_PATH = scan_path;
        // db.insertScanPath(scan_path)

        if(!skipCacheClean){
            cleanCache(cachePath);
        }
        setUpCacheWatch();

        const mecabHelper = require("./mecabHelper");
        mecabHelper.init();

        // let end1 = getCurrentTime();
        // let thumbnail_pathes = await pfs.readdir(thumbnailFolderPath);
        // thumbnail_pathes = thumbnail_pathes.filter(isImage).map(e => path.resolve(thumbnailFolderPath, e));
        // let end3 = getCurrentTime();
        // console.log(`[scan thumbnail] ${(end3 - end1) / 1000}s  to read thumbnail dirs`);
        // thumbnailDb.init(thumbnail_pathes);

        //因为scan path内部有sub parent重复关系，避免重复的
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
        initializeFileWatch(will_scan);
    }).on('error', async (error) => {
        logger.error("[Server Init]", error.message);
        //exit the current program
        await serverUtil.suspend();
        process.exit(22);
    });
}



/**
 * 设置cache folder的监听，其实没啥意义。
 */
function setUpCacheWatch() {
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
    
        const ext = pathUtil.getExt(p);
        return estimateIfFolder(p) || isDisplayableInOnebook(ext) || isVideo(ext);
    }

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


/** this function decide which files will be scanned and watched by ShiguReader  */
function shouldWatchForNormal(p, stat) {
    //cache is cover by another watch
    if (p.includes(cachePath)) {
        return false;
    }

    if (isHiddenFile(p) || pathUtil.isForbid(p)) {
        return false;
    }

    //if ignore, chokidar wont check its content
    if (stat && stat.isDirectory()) {
        return true;
    }

    const ext = pathUtil.getExt(p);
    let result = estimateIfFolder(p) || isDisplayableInExplorer(ext);

    if (view_img_folder) {
        result = result || isDisplayableInOnebook(ext)
    }
    return result;
}

function shouldIgnoreForNormal(p, stat) {
    return !shouldWatchForNormal(p, stat);
}

/** 文件被删除时，去相关数据库删除信息 */
const deleteCallBack = fp => {
    db.deleteFromDb(fp);
    zipInfoDb.deleteFromZipDb(fp);
    thumbnailDb.deleteThumbnail(fp)
};
serverUtil.common.deleteCallBack = deleteCallBack;

// const moveCallBack = async (oldfilePath, newfilePath) => {
//     // 现在 delete和insert被chokidar callback代劳了 
//     // 重复进行太容易出bug了
// }

// 隐私
function shrinkFp(fp){
    return fp.slice(0, 12) + "..." + fp.slice(fp.length - 10);
}

let is_chokidar_scan_done = false;
/** 
 * 程序启动时让chokidar监听文件夹，把需要的信息加到db。并做一些初始操作
 * 
 * */
function initializeFileWatch(dirPathes) {
    if(dirPathes.length == 0){
        printIP();
        return;
    }

    console.log("[chokidar initializeFileWatch] begin...");
    let beg = getCurrentTime();

    //watch file change
    //update two database
    const watcher = chokidar.watch(dirPathes, {
        ignored: shouldIgnoreForNormal,
        persistent: true,
        ignorePermissionErrors: true
    });

    let init_count = 0;

    //处理添加文件事件
    const addCallBack = async (fp, stats) => {
        // console.log(fp);
        // 突然想起来，这边其实可以存在到数据。最后一次加到db
        db.updateStatToDb(fp, stats);
        if (is_chokidar_scan_done) {
            // nothing
        } else {
            init_count++;
            if (init_count % 2000 === 0) {
                let end1 = getCurrentTime();
                let np = shrinkFp(fp);
                console.log(`[chokidar initializeFileWatch] scan: ${(end1 - beg) / 1000}s  ${init_count} ${np}`);
            }
        }
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
    watcher.on('ready', async () => {
        is_chokidar_scan_done = true;
        db.createSqlIndex();
        // DEBUG数据多少
        // setTimeout(async () => {
        //     const sqldb = db.getSQLDB();
        //     let sql = `SELECT count(*) as count FROM file_table `;
        //     let temp = await sqldb.allSync(sql);
        //     console.log(temp[0].count);

        //     sql = `SELECT count(*) as count FROM tag_table `;
        //     temp = await sqldb.allSync(sql);
        //     console.log(temp[0].count);
    
        //     // sql = `SELECT * FROM file_table `;
        //     // temp = await sqldb.allSync(sql);
        //     // console.log(temp); 
        // }, 5000);

        let end1 = getCurrentTime();
        console.log(`[chokidar initializeFileWatch] ${(end1 - beg) / 1000}s scan complete.`);
        console.log(`[chokidar initializeFileWatch] ${init_count} files were scanned`)
        console.log("----------------------------------------------------------------");
        console.log(`\n\n\n`);
        printIP();
    })

    return {
        watcher
    };
}


/**
 * 服务器使用中途添加监听扫描path
 */
function addNewFileWatchAfterInit(dirPathes) {
    if(dirPathes.length == 0){
        return;
    }

    console.log(`[chokidar addNewFileWatch] [${dirPathes.join(",")}] begin...`);
    let beg = getCurrentTime();

    // add to scan_path
    // TODO check with db to prevent duplicate adding shouldIgnoreForNormal
    // todo 不严谨 会出现重复添加
    global.SCANED_PATH = [...global.SCANED_PATH, ...dirPathes]


    //watch file change
    //update two database
    const watcher = chokidar.watch(dirPathes, {
        ignored: shouldIgnoreForNormal,
        persistent: true,
        ignorePermissionErrors: true
    });

    let init_count = 0;

    //处理添加文件事件
    const addCallBack = async (fp, stats) => {
        // console.log(fp);
        db.updateStatToDb(fp, stats);
       
        init_count++;
        if (init_count % 500 === 0) {
            let end1 = getCurrentTime();
            let np = shrinkFp(fp);
            console.log(`[chokidar addNewFileWatch] scan: ${(end1 - beg) / 1000}s  ${init_count} ${np}`);
        }
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
    watcher.on('ready', async () => {
        let end1 = getCurrentTime();
        console.log(`[chokidar] ${(end1 - beg) / 1000}s scan complete.`);
        console.log(`[chokidar] ${init_count} files were scanned`)
        console.log("----------------------------------------------------------------");
        console.log(`\n\n\n`);
    })

    return {
        watcher
    };
}

app.post('/api/addNewFileWatchAfterInit', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    if (!filePath || !(await isExist(filePath))) {
        logger.error("[/api/addNewFileWatchAfterInit]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if(isAlreadyScan(filePath)){
        res.send({ failed: true, reason: "ALREADY SCAN" });
        return;
    }

    addNewFileWatchAfterInit([filePath])
    res.send({ failed: false });
}));

async function printIP(){
    console.log("----------------------------------------------------------------");
    console.log(dateFormat(new Date(), "yyyy-mm-dd HH:MM"));
    console.log(`Express Server listening on port ${port}`);
    console.log("You can open ShiguReader from Browser now!");
    console.log(`http://localhost:${port}`);

    try {
        const ip = await getIP();
        console.log(ip);
        console.log("Scan the QR code to open on mobile devices");
        qrcode.generate(ip);
    } catch (e) { }
    console.log("----------------------------------------------------------------");
}

async function getThumbnailsForZip(filePathes) {
    const isStringInput = _.isString(filePathes);
    if (isStringInput) {
        filePathes = [filePathes];
    }

    const thumbnails = {};

    let end1 = getCurrentTime();
    let thumbRows = thumbnailDb.getThumbnailArr(filePathes);
    thumbRows.forEach(row => {
        thumbnails[row.filePath] = row.thumbnailFilePath;
    })
    let end3 = getCurrentTime();
    // console.log(`[getThumbnailsForZip] ${(end3 - end1) / 1000}s for ${filePathes.length} zips`);

    filePathes.forEach(filePath => {
        if (thumbnails[filePath]) {
            return;
        }
        if (isCompress(filePath)) {
            const zipInfoRows = zipInfoDb.getZipInfo(filePath);
            if(zipInfoRows[0]){
                const pageNum = zipInfoRows[0].pageNum;
                if (pageNum === 0) {
                    thumbnails[filePath] = "NO_THUMBNAIL_AVAILABLE";
                }
            }
        }
    });

    if (isStringInput) {
        return thumbnails[filePathes[0]]
    }

    return thumbnails;
}

async function findVideoForFolder(filePath){
    const sqldb = db.getSQLDB();
    const sql = `SELECT filePath FROM file_table WHERE  INSTR(filePath, ?) = 1 AND isDisplayableInExplorer = true `;
    let videoRows = await sqldb.allSync(sql, filePath);
    videoRows = videoRows.filter(row => {
        return isVideo(row.filePath);
    });
    return videoRows;
}

/**
 * 找文件夹的thumbnail
 */
async function getThumbnailForFolders(filePathes) {
    const result = {};

    if(!filePathes || filePathes.length == 0){
        return result;
    }

    function findOne(rows, filePath){
        let findRow = null;
        rows.forEach(row => {
            if(!findRow){
                if(isSub(filePath, row.filePath)){
                    findRow = row;
                }
            }
        })
        return findRow;
    }

    try{
        const sqldb = db.getSQLDB();
        let beg = getCurrentTime();

        // let label = "getThumbnailForFolders" + filePathes.length;
        // console.time(label);
        // 先尝试从thumbnail db拿
        let thumbnailRows = await thumbnailDb.getThumbnailForFolders(filePathes);
    
        let nextFilePathes = [];
        filePathes.forEach(filePath => {
            const findRow = findOne(thumbnailRows, filePath);
            if (findRow) {
                result[filePath] = findRow.thumbnailFilePath;
            }else{
                nextFilePathes.push(filePath);
            }
        })
        

        if(nextFilePathes.length > 0){
            //拿不到就看看有没有下属image
            // TODO 担心nextFilePathe很多的时候
            const stringsToMatch = nextFilePathes; // string array of values
            const patterns = stringsToMatch.map(str => `${str}%`);
            const placeholders = patterns.map(() => 'filePath LIKE ?').join(' OR ');
            const sql = `SELECT filePath FROM file_table WHERE isDisplayableInOnebook = true AND ${placeholders} `;
            let imagerows = await sqldb.allSync(sql, patterns);
            imagerows = imagerows.filter(row => {
                return isImage(row.filePath);
            });
            nextFilePathes.forEach(filePath => {
                const findRow = findOne(imagerows, filePath);
                if (findRow) {
                    result[filePath] = findRow.filePath;
                }
            })
        }
    
        let end = getCurrentTime();
        // console.log(`[getThumbnailForFolders] ${(end - beg)}ms for ${filePathes.length} zips`);
    }catch(e){
        logger.error("[getThumbnailForFolders]", e);
    }
    return result;
}

/** 获得file stat同时保存到db */
async function getStatAndUpdateDB(filePath) {
    const stat = await pfs.stat(filePath);
    if (isAlreadyScan(filePath)) {
        db.updateStatToDb(filePath, stat);
    }
    return stat;
}

/** 判断一个dir path是不是在scan路径上 */
function isAlreadyScan(dir) {
    return global.SCANED_PATH.some(sp => {
        return pathEqual(sp, dir) || pathUtil.isSub(sp, dir);
    });
}
/**
 * 给lsdir search res添加信息。比如thumbnail，zipinfo。不使用sql是因为有部分filePath没存在数据库
 */
async function decorateResWithMeta(resObj) {
    const { fileInfos, dirs, imgFolders } = resObj;
    console.assert(fileInfos && dirs && imgFolders);

    const files = _.keys(fileInfos);
    const thumbnails = await getThumbnailsForZip(files);

    const zipInfoRows = zipInfoDb.getZipInfo(files);
    const zipInfo = {};
    zipInfoRows.forEach(e => { 
        if(e){
            zipInfo[e.filePath] = e;
        }
    })
    resObj.zipInfo = zipInfo;

    resObj.thumbnails = thumbnails;
    const imgFolderInfo = db.getImgFolderInfo(imgFolders);
    resObj.imgFolderInfo = imgFolderInfo;

    // 把zipinfo的mtime合并到fileInfos
    // 并精简obj
    const allowZipInfo = ["pageNum", "musicNum", "videoNum", "totalNum", "totalImgSize"];
    for(const tempFilePath in zipInfo){
        const obj = zipInfo[tempFilePath];
        if(obj.mtime){
            fileInfos[tempFilePath] = fileInfos[tempFilePath] || {};
            if(!fileInfos[tempFilePath].mtimeMs){
                fileInfos[tempFilePath].mtimeMs = obj.mtime;
            }
        }
        zipInfo[tempFilePath] = filterObjectProperties(obj, allowZipInfo);
    }

    // resObj说明：
    // dirs:          [dir filepath...]
    // thumbnails:    filePath-> thumbnail filePath
    // fileInfos:     filePath-> fileInfo (不仅有zip，还有video和music)
    // zipInfo:       filePath-> zipInfo (和fileinfos互补)
    // imgFolderInfo: folderPath-> folderinfo
    // imgFolders:    folderPath -> [ file filepath ... ]
    // mode: 是否lack_info_mode
    // "tag", "author", "path" 查询时用的参数
    // 检查
    const allowedKeys = [ "dirs", "mode", "tag", "path", "author", "fileInfos", 
                          "thumbnails", "zipInfo", "imgFolderInfo"];
    // resObj = filterObjectProperties(resObj, allowedKeys, true);
    // checkKeys(resObj, allowedKeys);
    resObj = filterObjectProperties(resObj, allowedKeys);

    return resObj;
}

/** 检查回传给onebook的res */
function checkOneBookRes(resObj){
    const allowedKeys = ["zipInfo", "path", "stat", "imageFiles", "musicFiles", "videoFiles", "mecab_tokens", "outputPath"];
    checkKeys(resObj, allowedKeys);
    resObj = filterObjectProperties(resObj, allowedKeys, true);
    return resObj;
}

/** 开发用。检查的obj是不是都有这些key */
function checkKeys(obj, keys) {
    const objKeys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      if (!objKeys.includes(keys[i])) {
        console.warn("[checkKeys]", obj, keys[i]);
      }
    }
}
  

//写一个js函数，根据一个key list，只保留object需要的property
function filterObjectProperties(obj, keysToKeep, needWarn) {
    // 遍历对象的所有属性
    return Object.keys(obj).reduce((acc, key) => {
      // 如果当前属性存在于 keysToKeep 数组中，将其添加到新对象中
      if (keysToKeep.includes(key)) {
        acc[key] = obj[key];
      }else if(needWarn){
        console.warn("filterObjectProperties", key);
      }
      return acc;
    }, {});
  }


serverUtil.common.decorateResWithMeta = decorateResWithMeta
serverUtil.common.getThumbnailsForZip = getThumbnailsForZip;
serverUtil.common.getStatAndUpdateDB = getStatAndUpdateDB;
serverUtil.common.isAlreadyScan = isAlreadyScan;


const staticFileRouter = (req, res, next) => {
    const pp = req.path || "";
    if (pp && pp.includes("/api/")){
        next();
    }else{
        if(pp.endsWith("bundle.js")){
            // res.setHeader('Cache-Control', 'public, max-age=3047');
            res.sendFile(bundleJsPath);
        }else{
            res.setHeader('Cache-Control', 'public, max-age=3047');
            res.sendFile(indexHtmlPath);
        }
    }
}


// http://localhost:3000/explorer/
// http://localhost:3000/onebook/
// 前端路由需要redirect到index.html
//所有api都不需要转发
app.get('/*', staticFileRouter)

//---------login-----------

//TODO
// 疯狂发送请求洪水怎么处理
// 一个用户10秒最多100个请求？

const token_set = {};
app.post("/api/login", asyncWrapper(async (req, res) => {
    const password = req.body && req.body.password;
    if(password == etc_config.home_password || !etc_config.home_password){
        const token = serverUtil.makeid()
        token_set[token] = true;
        res.cookie('login-token', token, {maxAge: 1000 * 3600 * 24 });
        res.json({
            failed: false
        });
    }else{
        res.json({
            failed: true
        });
    }
}));

app.post("/api/logout", asyncWrapper(async (req, res) => {
    if(req.cookies && req.cookies["login-token"] && token_set[req.cookies["login-token"]]){
        delete token_set[req.cookies["login-token"]]
    }
    res.cookie('login-token', "")
    res.send({ failed: false });
}));

const exception_apis = [
    "/api/search",
    "/api/simple_search",
    "/api/download"
]

//check if login
app.use((req, res, next) => {
    //console.log("[" + req.path+ "]" + new Date());
    if(!etc_config.home_password){
        res.cookie('login-token', 'no-need-login-token', {maxAge: 1000 * 3600 * 1 });
        next();
    } else if(exception_apis.some(e => (req.path.includes(e)))){
        next();
    } else if(req.cookies && req.cookies["login-token"] && token_set[req.cookies["login-token"]]){
        next();
    }else{
        res.cookie('login-token', "")
        res.send({ failed: true, reason: "You need to login" });
    }
})

//-----------------thumbnail related-----------------------------------
app.post("/api/getThumbnailForFolders", asyncWrapper(async (req, res) => {
    const dirs = req.body && req.body.dirs;
    if (!dirs) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    dirs = dirs.filter(pathUtil.estimateIfFolder);

    const dirThumbnails = await getThumbnailForFolders(dirs);
    res.send({ failed: false, dirThumbnails });
}));

app.post("/api/getFileHistory", asyncWrapper(async (req, res) => {
    const all_pathes = req.body && req.body.all_pathes;
    if (!all_pathes) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    try{
        //需要拆分成好几个小array
        const fileHistory = [];
        const subs = util.cutIntoSmallArrays(all_pathes);
        for(const sub of subs){
            const temp = await historyDb.getFileHistory(sub);
            fileHistory.push(...temp);
        }

        // assert
        const subLength = subs.map(e => e.length).reduce(function(a, b) { return a + b; }, 0);
        console.assert(subLength === all_pathes.length);

        // const fileHistory = await historyDb.getFileHistory(all_pathes);
        res.send({ failed: false, fileHistory });
    }catch(e){
        res.send({failed: true})
    }
}));


app.post("/api/getTagThumbnail", asyncWrapper(async (req, res) => {
    const author = req.body && req.body.author;
    const tag = req.body && req.body.tag;
    if (!author && !tag) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    const cacheKey = tag || author;
    let oneThumbnail = memorycache.get(cacheKey);
    if(oneThumbnail){
        res.send({
            url: oneThumbnail
        })
        return;
    }

    const onlyNeedFew = true;
    const searchResult = await searchByTagAndAuthor(tag, author, null, onlyNeedFew);
    let { fileInfos, thumbnails } = searchResult;
    const thumbnailPathes =  _.values(thumbnails);
    oneThumbnail = thumbnailPathes[0];
    if(oneThumbnail){
        memorycache.put(cacheKey, oneThumbnail, 60*1000);
        // console.log(cacheKey);
        res.send({
            url: oneThumbnail
        })
        return;
    }

    const files = _.keys(fileInfos);
    const chosendFileName = serverUtil.chooseOneZipForOneTag(files, db.getFileToInfo());
    if (!chosendFileName) {
        res.send({ failed: true, reason: "No file found" });
        return;
    }

    extractThumbnailFromZip(chosendFileName, res);
}));

const thumbnailGenerator = require("./thumbnailGenerator");
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

            if (config.fastUpdateMode){
                const thumbRows = thumbnailDb.getThumbnailArr(filePath);
                if(thumbRows.length > 0){
                    return;
                }
            }
        }

        // 已经有了就不再生成thumbnail
        // 如果有thumbnail生成出问题，只能靠改filepath或者filename来促使重新生成
        // 但几乎没有重新生成必要
        const thumbRows = thumbnailDb.getThumbnailArr(filePath);
        if (thumbRows[0]) {
            sendImage(thumbRows[0].thumbnailFilePath);
        } else {
            if (!files) {
                files = (await listZipContentAndUpdateDb(filePath)).files;
            }

            //挑一个img来做thumbnail
            const thumb = serverUtil.chooseThumbnailImage(files);
            if (!thumb) {
                let reason = "[extractThumbnailFromZip] no img in this file " +  filePath;
                console.log(reason);
                sendable && res.send({ failed: true, reason });
                return;
            }

            //解压
            const stderrForThumbnail = await extractByRange(filePath, outputPath, [thumb])
            if (stderrForThumbnail) {
                // logger.error(stderrForThumbnail);
                throw "[extractThumbnailFromZip] extract exec failed"+filePath;
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
        logger.error("[extractThumbnailFromZip] exception", filePath, e);
        const reason = e || "NOT FOUND";
        sendable && res.send({ failed: true, reason });
    }
}

//  a huge back ground task
//  it generate all thumbnail and will be slow
let pregenerateThumbnails_lock = false;
app.post('/api/pregenerateThumbnails', asyncWrapper(async (req, res) => {
    let pregenerateThumbnailPath = req.body && req.body.pregenerateThumbnailPath;
    if (!pregenerateThumbnailPath) {
        res.send({ failed: true, reason: "NOT PATH" });
        return;
    } else if (pregenerateThumbnails_lock) {
        res.send({ failed: true, reason: "Already Running" });
        return;
    }

    pregenerateThumbnails_lock = true;
    const fastUpdateMode = req.body && req.body.fastUpdateMode;

    let totalFiles = [];
    if(pregenerateThumbnailPath == "All_Pathes"){
        totalFiles = await db.getAllFilePathes("WHERE isCompress=1");
    }else{
        function shouldScanForPreg(p, stat) {
            if (isHiddenFile(p)) {
                return false;
            }
            const ext = pathUtil.getExt(p);
            return estimateIfFolder(p) || isCompress(ext);
        }

        const { pathes } = await fileiterator(pregenerateThumbnailPath, {
            doNotNeedInfo: true,
            filter: shouldScanForPreg
        });
        totalFiles = pathes.filter(isCompress);
        // totalFiles = await db.getAllFilePathes("WHERE isCompress=1");
        // totalFiles = totalFiles.filter(e => e.includes(pregenerateThumbnailPath));
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
            logger.error(e);
        }
        const time2 = getCurrentTime();
        const timeUsed = (time2 - pregenBeginTime) / 1000;
        const secPerFile = timeUsed / ii;
        const remainTime = (total - ii) * secPerFile / 60;
        console.log(`[pre-generate minify] total: ${total}   ${(ii / total * 100).toFixed(2)}%    ${(secPerFile).toFixed(2)} sec/file    ${remainTime.toFixed(2)} mim left`);
    }

    pregenerateThumbnails_lock = false;
    console.log('[pregenerate] done');
}));


// TODO 快速的获取任意文件或者文件夹的thumbnail
app.get('/api/getQuickThumbnail', asyncWrapper(async (req, res) => {
    let filePath = req.query.p;

    if (!filePath) {
        res.send({ failed: true, reason: "bad param" });
        return;
    }

    let useVideoPreviewForFolder = false;
    let url = null;
    if(isCompress(filePath)){
        let thumbRows = thumbnailDb.getThumbnailArr(filePath);
        if(thumbRows.length > 0){
            url = thumbRows[0].thumbnailFilePath;
        }else{
            const fileName = path.basename(filePath);
            thumbRows = await thumbnailDb.getThumbnailByFileName(fileName);
            if(thumbRows.length > 0){
                url = thumbRows[0].thumbnailFilePath;
            }
        }
    } else if(estimateIfFolder(filePath)){
        const dirThumbnails = await getThumbnailForFolders([filePath]);
        url = dirThumbnails[filePath];

        // 没thumbnail，用video也行。
        if(!url){
            const videoRows = await findVideoForFolder(filePath);
            if(videoRows[0]){
                url = videoRows[0].filePath;
                useVideoPreviewForFolder = true;
            }
        }
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Connection', 'Keep-Alive');
    res.setHeader('Keep-Alive', 'timeout=50, max=1000');
    res.send({
        url: url,
        useVideoPreviewForFolder
    });
}))

app.post('/api/getZipThumbnail', asyncWrapper(async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if(!isCompress(filePath)){
        res.send({ failed: true, reason: "not a zip" });
        return;
    }

    const thumbnails = await getThumbnailsForZip([filePath])
    const oneThumbnail = _.values(thumbnails)[0];
    if(oneThumbnail){
    
        res.send({
            url: oneThumbnail
        })
        return;
    }

    extractThumbnailFromZip(filePath, res);
}));

async function getSameFileName(filePath) {
    if (!(await isExist(filePath))) {
        //maybe the file move to other location
        const fn = path.basename(filePath);
        const dir = path.dirname(filePath);

        const sqldb = db.getSQLDB();
        let sql = `SELECT filePath FROM zip_view WHERE fileName LIKE ? AND filePath NOT LIke ? `;
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

const current_extract_queue = {};
const extract_result_cache = {};
app.post('/api/extract', asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    const startIndex = (req.body && req.body.startIndex) || 0;
    let stat;
    if (!filePath) {
        res.send({ failed: true, reason: "No parameter" });
        return;
    }

    if(!isCompress(filePath)){
        res.send({ failed: true, reason: "not a zip" });
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

    // const time1 = getCurrentTime();

    async function sendBack(contentObj, path, stat) {
        const { files, musicFiles, videoFiles } = contentObj

        const tempFiles = files.filter(e => {
            return !isHiddenFile(e);
        });
        let zipInfo;
        if (tempFiles.length > 0) {
            const zipInfoRows = zipInfoDb.getZipInfo(files);
            zipInfo = zipInfoRows[0];
        }

        const mecab_tokens = await global.mecab_getTokens(path);

        let result = { imageFiles: tempFiles, musicFiles, videoFiles, path, outputPath, stat, zipInfo, mecab_tokens };
        extract_result_cache[filePath] = result;
        checkOneBookRes(result);
        res.send(result);

        historyDb.addOneRecord(filePath);
    }

    const outputPath = path.join(cachePath, getHash(filePath));
    // const temp = cacheDb.getCacheFiles(outputPath);
    // TODO 各种情况的避免重新解压
    // check if alreay unzip
    // if (zipInfoDb.has(filePath) && temp) {
    //     let tempZipInfo = zipInfoDb.getZipInfo(filePath);
    //     const totalNum = tempZipInfo.totalNum;
    //     const _files = temp.files || [];

    //     if (totalNum > 0 && _files.length >= totalNum) {
    //         sendBack(temp, filePath, stat);
    //         return;
    //     } else if (totalNum === 0) {
    //         sendBack({}, filePath, stat);
    //         return;
    //     }
    // }

    // 这样zip内容改变对应不了，但我很少这么操作
    if(extract_result_cache[filePath]){
        res.send(extract_result_cache[filePath]);
        historyDb.addOneRecord(filePath);
        return;
    }


    let hasDuplicate = false;
    async function _extractAll_(){
        const { pathes, error } = await extractAll(filePath, outputPath, hasDuplicate);
        if (!error && pathes) {
            const contentUrls = generateContentUrl(pathes, outputPath);
            sendBack(contentUrls, filePath, stat);
        } else {
            throw "fail to extract all"
        }
    }

    const full_extract_max = 10;
    try {
        stat = await getStatAndUpdateDB(filePath);
        if(current_extract_queue[filePath] === "in_progress"){
            res.send({ failed: true, reason: "extract_in_progress" });
            return;
        }
        current_extract_queue[filePath] = "in_progress";

        let { files, fileInfos } = await listZipContentAndUpdateDb(filePath);
        // let hasMusic = files.some(e => isMusic(e));
        // let hasVideo = files.some(e => isVideo(e));
        const imgfiles = files.filter(e => isImage(e));
        const musicFiles = files.filter(e => isMusic(e));
        const videoFiles = files.filter(e => isVideo(e));
        if (files.length === 0) {
            throw `${filePath} has no content`
        }

        const fnInZip = files.map(e => path.basename(e));
        hasDuplicate = util.hasDuplicate(fnInZip);
        const shouldExtractFull =  files.length <= full_extract_max || hasDuplicate;

        //todo: music/video may be huge and will be slow
        if (shouldExtractFull) {
            await  _extractAll_()
        } else {
            //spit one zip into two uncompress task
            //so user can have a quicker response time
            //  优先图片
            serverUtil.sortFileNames(imgfiles);
            const tempfiles = [...imgfiles, ...musicFiles];
            const PREV_SPACE = 2;
            //cut the array into 3 parts
            const beg = startIndex - PREV_SPACE;
            const end = startIndex + full_extract_max - PREV_SPACE;
            const firstRange = arraySlice(tempfiles, beg, end);
            let secondRange = tempfiles.filter(e => {
                return !firstRange.includes(e);
            })
            secondRange = [...secondRange,  ...videoFiles];
            const totalRange = [...firstRange, ...secondRange];

            const stderr = await extractByRange(filePath, outputPath, firstRange)
            if (!stderr) {
                const unzipOutputPathes = totalRange.map(e => path.resolve(outputPath,  path.basename(e)));
                const contentUrls = generateContentUrl(unzipOutputPathes, outputPath);
                sendBack(contentUrls, filePath, stat);
                // const time2 = getCurrentTime();
                // const timeUsed = (time2 - time1);
                // console.log(`[/api/extract] FIRST PART UNZIP ${filePath} : ${timeUsed}ms`);

                await extractByRange(filePath, outputPath, secondRange);
            } else {
                //seven的谜之抽风
                if(stderr === "NEED_TO_EXTRACT_ALL" && files.length <= 100){
                   await _extractAll_()
                }else{
                    throw stderr;
                }
            }
        }
    } catch (e) {
        res.send({ failed: true, reason: e });
        logger.error('[/api/extract] exit: ', e);
    }finally{
        current_extract_queue[filePath] = "done"
    }
}));


app.get('/api/getGeneralInfo', asyncWrapper(async (req, res) => {
    const cacheKey = "GeneralInfoCacheKey";
    let result = memorycache.get(cacheKey);
    if(!result){
        let os = global.isWindows ? "windows" : "linux";
        const ip = await getIP();
        result = {
            server_os: os,
            file_path_sep: path.sep,
            has_magick: global._has_magick_,
            server_ip: ip,
    
            good_folder: global.good_folder,
            not_good_folder: global.not_good_folder,
            move_pathes: global.move_pathes,
            recentAccess: global.recentAccess 
        };
        
        memorycache.put(cacheKey, result, 30 * 1000)
    }

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(result)
}));


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

const cleanCacheRoute = require("./routes/cleanCache");
app.use(cleanCacheRoute);

const CacheInfo = require("./routes/CacheInfo");
app.use(CacheInfo);

const shutdown = require("./routes/shutdown");
app.use(shutdown);

const minifyZip = require("./routes/minifyZip");
const e = require('express');
app.use(minifyZip);

// const ehentaiMetadata = require("./routes/ehentaiMetadata");
// app.use(ehentaiMetadata);

// const fileServer = require("./routes/fileServer");
// app.use(fileServer);

app.post('/*', (req, res) => {
    res.sendStatus(404);
})

init();

