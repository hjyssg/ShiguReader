const path = require('path');
const express = require('express');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const _ = require('underscore');
const qrcode = require('qrcode-terminal');

global.isWindows = require('is-windows')();

const execa = require('./utils/ownExeca');
const util = require('./common/util');
const userConfig = require('./config/user-config');
const pathUtil = require('./utils/pathUtil');
const serverUtil = require('./utils/serverUtil');
const { getHash, asyncWrapper } = serverUtil;
const filewatch = require('./services/fileWatchers/filewatch');
const thumbnailUtil = require('./services/getThumbnailUtil');
const initializeEnvironment = require('./bootstrap/environment');
const loadConfig = require('./bootstrap/loadConfig');
const createWatchManager = require('./bootstrap/watchManager');
const appState = require('./state/appState');

const { isHiddenFile, splitFilesByType, isExist, filterPathConfig, isSub, estimateIfFolder } = pathUtil;

const { isImage, isCompress, isVideo, isMusic, getCurrentTime } = util;

const environment = initializeEnvironment();
const {
    rootPath,
    cachePath,
    thumbnailFolderPath,
    workspacePath,
    distPath,
    indexHtmlPath,
    bundleJsPath,
    etcConfigPath,
    pathConfigPath,
} = environment;

appState.setPaths({ cachePath, thumbnailFolderPath });
appState.setScannedPaths([]);

console.log("------path debug-----------------------------------------------");
console.log("__filename:         ", __filename);
console.log("__dirname:          ", __dirname);
console.log("process.execPath:   ", process.execPath);
console.log("process.cwd():      ", process.cwd());
console.log("global.isPkg:       ", global.isPkg);
console.log("rootPath:           ", rootPath);
console.log("distPath:           ", distPath);
console.log("indexHtmlPath:      ", indexHtmlPath);
console.log("bundleJsPath:       ", bundleJsPath);
console.log("etf_config_path:    ", etcConfigPath);
console.log("path_config_path:   ", pathConfigPath);
console.log("workspacePath:      ", workspacePath);
console.log("----------------------------------------------------------------");

const logger = require('./config/logger');
logger.init();

const sevenZipHelp = require('./services/sevenZipHelp');
sevenZipHelp.init();
const { listZipContentAndUpdateDb, extractAll, extractByRange } = sevenZipHelp;

const resolveExtractedEntry = (baseOutputPath, entryPath) => {
    if (!entryPath) {
        return null;
    }
    const normalizedBase = path.resolve(baseOutputPath);
    const normalizedEntry = path.normalize(entryPath);
    const candidate = path.resolve(normalizedBase, normalizedEntry);
    return isSub(normalizedBase, candidate) ? candidate : null;
};
// 从用户命令拿port和其他参数
const portConfig = require('./config/port-config');
const { program } = require('commander');
program
    .option('-p, --port <number>', 'Specify the port',  portConfig.default_http_port)
    .option('--skip-scan', 'skip initial scan for startup fasted', false)
    .option('--skip-cache-clean', 'skip initial cache clean', false)
    .option('--print-qr-code [boolean]', '', true);

program.parse(process.argv);
const options = program.opts();
const port = _.isString(options.port)? parseInt(options.port): options.port; // 懒得细看commander，不是最正确写法
const skipScan = options.skipScan;
const skipCacheClean = options.skipCacheClean;
const printQrCode = options.printQrCode === "false" ? false : options.printQrCode;
// console.log("port: ", port);
// console.log("skipScan: ", skipScan);
// console.log("skipCacheClean: ", skipCacheClean);

console.log(options);



// DB import
const db = require("./models/db");
const zipInfoDb = require("./models/zipInfoDb");
const thumbnailDb = require("./models/thumbnailDb");
const historyDb = require("./models/historyDB");
const cacheDb = require("./models/cacheDb");

const watchManager = createWatchManager({
    cacheDb,
    db,
    filewatch,
    zipInfoDb,
    thumbnailDb,
    viewImgFolder: userConfig.view_img_folder,
});
const { addDirsToWatch, setUpCacheWatch, filterScanPaths } = watchManager;

// 防止系统过载
const pLimit = require('p-limit');
const thumbnail_limit = pLimit(10);
const unzip_limit = pLimit(3);
const folder_stat_limit = pLimit(20);


const app = express();

// express的静态文件middle ware，但有时不好使。还需要staticFileRouter()
app.use(express.static(distPath, {
    maxAge: (1000 * 3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000 * 3600).toString() // uses milliseconds per docs
}));


const modifyResponseForChart = require('./middleware/chartResponseMiddleware');
// 将中间件应用到指定的 API 路由
app.use(['/api/lsDir', '/api/search', '/api/allInfo'], modifyResponseForChart);

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
// https://stackoverflow.com/questions/50304779/payloadtoolargeerror-request-entity-too-large?noredirect=1&lq=1
app.use(express.json({limit: '50mb'}));

const cookieParser = require('cookie-parser')
app.use(cookieParser())

//read etc config
const { etcConfig: loadedEtcConfig, pathConfig: loadedPathConfig } = loadConfig({
    etcConfigPath,
    pathConfigPath,
    logger,
});
let etc_config = loadedEtcConfig || {};
let path_config = loadedPathConfig;
global.etc_config = etc_config;

const internalIp = require('internal-ip');
async function getIP(){
    const lanIP = await internalIp.v4();
    const mobileAddress = `http://${lanIP}:${port}`;
    return mobileAddress;
}

const cleanCache = require("./services/cleanCache");

try {
    // 因为sharp在pkg用不了，灵活的逻辑
    global.sharp = require('sharp')
} catch (e) {
    // 有image magick也行
    logger.warn("[Warning] Did not install sharp");
    // logger.warn(e);
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
            logger.warn("Changing console encoding to utf8 in Windows language setting is recommended");
        }

        global._cmd_encoding = charset;
    }

    // console.log(indexHtmlPath)
    if (!(await isExist(indexHtmlPath))) {
        logger.warn(`[Error] No ${indexHtmlPath} for producation`);
        logger.warn("[Error] You may need to run npm run build");
    }

    const sqldb = await db.init();
    await thumbnailDb.init(sqldb);
    await historyDb.init(sqldb);
    await zipInfoDb.init(sqldb);
    
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
        Object.assign(global, filterPathConfigObj);

        let scan_path = await pathUtil.filterNonExist(filterPathConfigObj?.scan_path || []);
        serverUtil.mkdirList(scan_path);
        appState.setScannedPaths(scan_path);

        if(!skipCacheClean){
            cleanCache(cachePath);
        }
        setUpCacheWatch();

        const will_scan = filterScanPaths(scan_path);

        printIP();

        await addDirsToWatch(will_scan);
        
    }).on('error', async (error) => {
        logger.error("[Server Init]", error.message);
        //exit the current program
        await serverUtil.suspend();
        process.exit(22);
    });
}

app.post('/api/addNewFileWatchAfterInit', serverUtil.asyncWrapper(async (req, res) => {
    let filePath = req.body && req.body.filePath;
    if (!filePath || !(await isExist(filePath))) {
        logger.error("[/api/addNewFileWatchAfterInit]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if(filewatch.isAlreadyScan(filePath)){
        res.send({ failed: true, reason: "ALREADY SCAN" });
        return;
    }

    await addDirsToWatch([filePath]);
    res.send({ failed: false });
}));

async function printIP(){
    console.log("----------------------------------------------------------------");
    console.log(dateFormat(new Date(), "yyyy-mm-dd HH:MM"));
    console.log(`Express Server listening on port ${port}`);
    console.log("You can open ShiguReader from Browser now!");
    console.log(`http://localhost:${port}`);

    try {
        if(printQrCode){

            const ip = await getIP();
            console.log(ip);
            console.log("Scan the QR code to open on mobile devices");
            qrcode.generate(ip);
        }
    } catch (e) { 
        //nothing
    }
    console.log("----------------------------------------------------------------");
}


async function findVideoForFolder(filePath){
    const sql = `SELECT filePath FROM file_table WHERE INSTR(filePath, ?) = 1 AND isVideo `;
    let videoRows = await db.doSmartAllSync(sql, filePath);
    return videoRows;
}

async function findZipForFolder(filePath){
    const sql = `SELECT filePath FROM zip_view WHERE INSTR(filePath, ?) = 1 ORDER BY mTime DESC LIMIT 1`;
    const zipRows = await db.doSmartAllSync(sql, filePath);
    if (zipRows[0]) {
        return zipRows;
    }

    const fallbackZip = await findLatestFileInFolder(filePath, isCompress);
    if (fallbackZip) {
        return [fallbackZip];
    }
    return [];
}

async function findLatestFileInFolder(dirPath, matcher){
    const entries = await pathUtil.readdirOneLevel(dirPath, { withFileTypes: true });
    if (!entries || entries.length === 0) {
        return null;
    }

    const candidatePromises = entries.map((entry) => folder_stat_limit(async () => {
        try {
            if (!entry || typeof entry.isFile !== "function" || !entry.isFile()) {
                return null;
            }

            const name = entry.name;
            if (!matcher(name)) {
                return null;
            }

            const absolutePath = path.join(dirPath, name);
            const stat = await pfs.stat(absolutePath);
            const mTime = typeof stat.mtimeMs === "number"
                ? stat.mtimeMs
                : (stat.mtime instanceof Date ? stat.mtime.getTime() : 0);

            return {
                filePath: absolutePath,
                mTime
            };
        } catch (error) {
            const absolutePath = path.join(dirPath, entry && entry.name ? entry.name : "");
            logger.warn(`[findLatestFileInFolder] failed to inspect ${absolutePath}`);
            logger.warn(error);
            return null;
        }
    }));

    const candidates = await Promise.all(candidatePromises);

    const sorted = candidates
        .filter(Boolean)
        .sort((a, b) => (b.mTime || 0) - (a.mTime || 0));

    return sorted[0] || null;
}


/** 获得file stat同时保存到db */
async function getStatAndUpdateDB(filePath) {
    const stat = await pfs.stat(filePath);
    if (filewatch.isAlreadyScan(filePath)) {
        db.updateStatToDb(filePath, stat);
    }
    return stat;
}


/**
 * 给lsdir search res添加信息。比如thumbnail，zipinfo。不使用sql是因为有部分filePath没存在数据库
 */
async function decorateResWithMeta(resObj) {
    const { fileInfos, dirs, imgFolders } = resObj;
    console.assert(fileInfos && dirs && imgFolders);

    const files = _.keys(fileInfos);

    //------------------- thumbnails
    const thumbnails = await thumbnailUtil.getThumbnailsForZip(files);
    _.keys(thumbnails).forEach(filePath=> {
        if(!fileInfos[filePath]){
            return;
        }
        const e = thumbnails[filePath];
        fileInfos[filePath].thumbnailFilePath = e;
    })


    //------------------------------- zipInfo
    const zipInfoRows = zipInfoDb.getZipInfo(files);
    zipInfoRows.forEach(e => { 
        if(!fileInfos[e.filePath]){
            return;
        }
        fileInfos[e.filePath] = {
            ...fileInfos[e.filePath],
            pageNum: e.pageNum,
            musicNum: e.musicNum,
            videoNum: e.videoNum,
            totalNum: e.totalNum,
            totalImgSize: e.totalImgSize,
        }
        fileInfos[e.filePath].mtimeMs = fileInfos[e.filePath].mtimeMs || e.mtime;
        fileInfos[e.filePath].size = fileInfos[e.filePath].size || e.totalSize;
    })

    //------------------------ imgFolderInfo
    const imgFolderInfo = db.getImgFolderInfo(imgFolders);
    resObj.imgFolderInfo = imgFolderInfo;

    //-------------------- history
    const pathes_for_history = [...files, ..._.keys(imgFolderInfo)];
    resObj.fileHistory = await historyDb.getBatchFileHistory(pathes_for_history);

    //----------------------------- ParseCache
    resObj.nameParseCache = {};
    [...files, ..._.keys(imgFolderInfo), ...dirs].forEach(fp => {
        const fn = path.basename(fp);
        const temp = serverUtil.parse(fn);
        if(temp){
            resObj.nameParseCache[fn] = temp;
        }
    })

    // const allowZipInfo = ["pageNum", "musicNum", "videoNum", "totalNum", "totalImgSize"];
    // for(const tempFilePath in zipInfo){
    //     const zipObj = zipInfo[tempFilePath];
    //     // 把zipinfo的mtime合并到fileInfos
    //     if(zipObj.mtime){
    //         fileInfos[tempFilePath] = fileInfos[tempFilePath] || {};
    //         if(!fileInfos[tempFilePath].mtimeMs){
    //             fileInfos[tempFilePath].mtimeMs = zipObj.mtime;
    //         }
    //     }
    //     // 并精简obj
    //     zipInfo[tempFilePath] = filterObjectProperties(zipObj, allowZipInfo);
    // }

    // resObj说明：

    // [deprecated] thumbnails:    filePath-> thumbnail filePath
    // [deprecated] zipInfo:       filePath-> zipInfo (和fileinfos互补)
    // [deprecated] imgFolders:    folderPath -> [ file filepath ... ]

    // dirs:          [dir filepath...]
    // fileInfos:     filePath-> fileInfo (不仅有zip，还有video和music)
    // imgFolderInfo: folderPath-> folderinfo
    // mode: 是否lack_info_mode
    // "tag", "author", "path" 查询时用的参数
    // 检查
    const allowedKeys = [ "dirs", "mode", "tag", "path", "author", "fileInfos", 
                          "imgFolderInfo", "fileHistory", "nameParseCache"];
    // resObj = filterObjectProperties(resObj, allowedKeys, true);
    // checkKeys(resObj, allowedKeys);
    resObj = serverUtil.filterObjectProperties(resObj, allowedKeys);

    return resObj;
}

  



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

const cors = require('cors');
app.use(cors());

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
        res.cookie('login-token', token, {maxAge: 30 * 1000 * 3600 * 24 });
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
    let dirs = req.body && req.body.dirs;
    if (!dirs) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    dirs = dirs.filter(pathUtil.estimateIfFolder);

    const dirThumbnails = await  thumbnailUtil.getThumbnailForFolders(dirs);
    res.send({ failed: false, dirThumbnails });
}));


const FOLDER_THUMBNAIL_CACHE_CONTROL = "public, max-age=300";

app.get("/api/folderThumbnailFromDisk", asyncWrapper(async (req, res) => {
    const filePath = req.query && req.query.filePath;

    if (!filePath || !(await isExist(filePath)) || !estimateIfFolder(filePath)) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    const applyCacheHeader = () => {
        res.setHeader("Cache-Control", FOLDER_THUMBNAIL_CACHE_CONTROL);
    };

    const dirThumbnails = await thumbnailUtil.getThumbnailForFolders([filePath]);
    const existing = dirThumbnails[filePath];
    if (existing) {
        applyCacheHeader();
        res.send({
            url: existing,
            debug: "from getThumbnailForFolders"
        });
        return;
    }

    const zipRows = await findZipForFolder(filePath);
    if (zipRows[0]) {
        extractThumbnailFromZip(zipRows[0].filePath, res, undefined, {
            onSuccess: applyCacheHeader
        });
        return;
    }

    const imageRow = await findLatestFileInFolder(filePath, isImage);
    if (imageRow) {
        applyCacheHeader();
        res.send({
            url: imageRow.filePath,
            debug: "from folder image"
        });
        return;
    }

    res.send({ failed: true, reason: "No file found" });
}));


app.post("/api/getTagThumbnail", asyncWrapper(async (req, res) => {
    const author = req.body && req.body.author;
    const tag = req.body && req.body.tag;
    if (!author && !tag) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    if (author && tag) {
        res.send({ failed: true, reason: "only one Parameter" });
        return;
    }


    let temp = thumbnailUtil.getTagThumbnail(author, tag);
    if(temp){
        res.send(temp);
        return;
    }

    const sql3 = ` SELECT a.* , b.*
        FROM file_table a 
        INNER JOIN tag_file_table b ON a.filePath = b.filePath AND b.tag = ? AND a.isCompress
        ORDER BY a.mTime DESC 
        LIMIT 1 
    `
    const zipRows = await db.doSmartAllSync(sql3, [author || tag]);
    // 没有的话，现场unzip一个出来
    if (zipRows[0]) {
        extractThumbnailFromZip(zipRows[0].filePath, res);
    } else {
        res.send({ failed: true, reason: "No file found" });
    }
}));

const thumbnailGenerator = require("./services/thumbnailGenerator");
//the only required parameter is filePath
let extractThumbnailFromZip = async (filePath, res, mode, config) => {
    if (!util.isCompress(filePath)) {
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    let sendable = !isPregenerateMode && !!res;
    const outputPath = path.join(cachePath, getHash(filePath));
    const normalizedConfig = config || {};
    const onSuccess = typeof normalizedConfig.onSuccess === "function" ? normalizedConfig.onSuccess : null;

    function sendImage(imgFp) {
        if (sendable) {
            if (onSuccess) {
                try {
                    onSuccess(imgFp);
                } catch (callbackError) {
                    logger.warn("[extractThumbnailFromZip] onSuccess callback failed");
                    logger.warn(callbackError);
                }
            }
            res.send({
                url: imgFp
            })
        }
    }

    function sendError(reason){
        sendable && res.send({ failed: true, reason });
    }

    try {
        const zipInfo = (await listZipContentAndUpdateDb(filePath));

        // 已经有了就不再生成thumbnail
        // 如果有thumbnail生成出问题，只能靠改filepath或者filename来促使重新生成
        // 但几乎没有重新生成必要
        const thumbRows = thumbnailDb.getThumbnailArr(filePath);
        if (thumbRows[0]) {
            sendImage(thumbRows[0].thumbnailFilePath);
            return;
        } 

        //挑一个img来做thumbnail
        let thumbInnerPath = serverUtil.chooseThumbnailImage(zipInfo.files);
        if (!thumbInnerPath) {
            let reason = "[extractThumbnailFromZip] no img in this file " +  filePath;
            console.log(reason);
            sendError(reason)
            return;
        }


        //解压
        const stderrForThumbnail = await extractByRange(filePath, outputPath, [thumbInnerPath])
        if(stderrForThumbnail === "NEED_TO_EXTRACT_ALL"){
            const SMALL_SIZE = 100 * 1000 * 1000;
            if(zipInfo.info.totalSize < SMALL_SIZE){
                const { pathes, error } = await extractAll(filePath, outputPath, false);
                if (error) {
                    throw error
                } else {
                    thumbInnerPath = serverUtil.chooseThumbnailImage(pathes);
                }
            }else  {
                let extensions = zipInfo.files.filter(isImage).map(path.extname).map(e => "*"+e);
                extensions = _.unique(extensions);
                console.assert(extensions.length > 0)
                const { error, pathes } = await  sevenZipHelp.extractByExtension(filePath, outputPath, extensions )
                if (error) {
                    throw error
                } else {
                    thumbInnerPath = serverUtil.chooseThumbnailImage(pathes);
                }
            }

        } else if (stderrForThumbnail) {
            const reason = "Cannot extract thumbnail currently"
            sendError(reason)
            return;
        }
        
        // send original img path to client as thumbnail
        // 这里必须重新解析一次，避免 7-Zip 的返回路径逃离缓存目录
        const resolvedThumb = resolveExtractedEntry(outputPath, thumbInnerPath);
        if (!resolvedThumb) {
            sendError("Cannot locate thumbnail inside cache");
            return;
        }
        sendImage(resolvedThumb);
        sendable = false;


        //compress into real thumbnail
        const outputFilePath = await thumbnailGenerator(
            thumbnailFolderPath,
            path.dirname(resolvedThumb),
            path.basename(resolvedThumb)
        );
        if (outputFilePath) {
            thumbnailDb.addNewThumbnail(filePath, outputFilePath);
            // 想删除除了要使用的文件，但不行。各种文件系统错误
        }
    } catch (e) {
        if(e && e.toString() !== "NEED_TO_EXTRACT_ALL"){
            logger.error("[extractThumbnailFromZip] exception ", filePath, e);
        }
        const reason = e || "TBD";
        sendError(reason)
    }
}

function withLimit(fn) {
    return function(...args) {
        return thumbnail_limit(() => fn(...args));
    };
}
extractThumbnailFromZip = withLimit(extractThumbnailFromZip)


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
        totalFiles = await db.getAllFilePathes("WHERE isCompress");
    }else{
        const { pathes } = await pathUtil.readDirForFileAndFolder(pregenerateThumbnailPath, true);
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
        url = await  thumbnailUtil.getQuickThumbnailForZip(filePath);
    } else if(estimateIfFolder(filePath)){
        const dirThumbnails = await thumbnailUtil.getThumbnailForFolders([filePath]);
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

    let url = await thumbnailUtil.getQuickThumbnailForZip(filePath);
    if(url){
        res.send({
            url,
            debug: "from getQuickThumbnailForZip"
        })
        // 还是多生成一下
        extractThumbnailFromZip(filePath);
    }else{
        extractThumbnailFromZip(filePath, res);
    }
}));

async function getZipWithSameFileName(filePath) {
    if (!(await isExist(filePath)) && isCompress(filePath)) {
        //maybe the file move to other location
        const fn = path.basename(filePath);
        const tempP = pathUtil.getImgConverterCachePath();
        let sql = `SELECT filePath FROM zip_view WHERE fileName LIKE ? AND filePath != ? AND filePath NOT LIKE ? `;
        let rows = await db.doSmartAllSync(sql, [('%' + fn + '%'), filePath, (tempP + "%")]);
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

    //todo: record the timestamp of each request
    //when cleaning cache, if the file is read recently, dont clean its cache
    filePath = await getZipWithSameFileName(filePath);
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
        // let zipInfo;
        // if (tempFiles.length > 0) {
        //     const zipInfoRows = zipInfoDb.getZipInfo(files);
        //     zipInfo = zipInfoRows[0];
        // }
        let zipInfo = zipInfoDb.getZipInfo(filePath)[0];

        const mecab_tokens = [];

        // TODO dirs留空。
        let result = { imageFiles: tempFiles, musicFiles, videoFiles, path, outputPath, stat, zipInfo, mecab_tokens, dirs: [] };
        extract_result_cache[filePath] = result;
        result = serverUtil.checkOneBookRes(result);
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
            const contentUrls = splitFilesByType(pathes, outputPath);
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
            await unzip_limit(_extractAll_);
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
            const firstRange = util.arraySlice(tempfiles, beg, end);
            let secondRange = tempfiles.filter(e => {
                return !firstRange.includes(e);
            })
            secondRange = [...secondRange,  ...videoFiles];
            const totalRange = [...firstRange, ...secondRange];

            const stderr = await unzip_limit(()=> extractByRange(filePath, outputPath, firstRange));
            if (!stderr) {
                const resolvedOutputPath = path.resolve(outputPath);
                // 将压缩包内的相对路径转为绝对路径，同时过滤掉不合法的项目
                const unzipOutputPathes = totalRange
                    .map(e => resolveExtractedEntry(outputPath, e))
                    .filter(Boolean);
                const contentUrls = splitFilesByType(unzipOutputPathes, resolvedOutputPath);
                sendBack(contentUrls, filePath, stat);
                // const time2 = getCurrentTime();
                // const timeUsed = (time2 - time1);
                // console.log(`[/api/extract] FIRST PART UNZIP ${filePath} : ${timeUsed}ms`);

                await extractByRange(filePath, outputPath, secondRange);
            } else {
                if(stderr === "NEED_TO_EXTRACT_ALL"){
                    await unzip_limit(_extractAll_);
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

serverUtil.common = {
    deleteCallBack,
    decorateResWithMeta,
    getStatAndUpdateDB
}

let server_ip;
app.get('/api/getGeneralInfo', asyncWrapper(async (req, res) => {
    let os = global.isWindows ? "windows" : "linux";
    if(!server_ip){
        server_ip = await getIP();
    }

    const result = {
        server_os: os,
        file_path_sep: path.sep,
        has_magick: global._has_magick_,
        server_ip,

        good_folder: global.good_folder,
        not_good_folder: global.not_good_folder,
        good_folder_root: global.good_folder_root,
        not_good_folder_root: global.not_good_folder_root,

        move_pathes: global.move_pathes,
        recentAccess: global.recentAccess 
    };
    res.setHeader('Cache-Control', 'public, max-age=30');
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
app.use(minifyZip);

// const ehentaiMetadata = require("./routes/ehentaiMetadata");
// app.use(ehentaiMetadata);

// const fileServer = require("./routes/fileServer");
// app.use(fileServer);

app.post('/*', (req, res) => {
    res.sendStatus(404);
})

init();

