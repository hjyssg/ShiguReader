
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import pfs from 'promise-fs';
import dateFormat from 'dateformat';
import _ from 'underscore';
import qrcode from 'qrcode-terminal';
import isWindows from 'is-windows';

// Global variable declarations
declare global {
    var isWindows: boolean;
    var isPkg: boolean;
    var _cmd_encoding: number;
    var sharp: any;
    var etc_config: any;
    var _has_magick_: boolean;
    var good_folder: any;
    var not_good_folder: any;
    var good_folder_root: any;
    var not_good_folder_root: any;
    var move_pathes: any;
    var recentAccess: any;
    var downloadFolder: any;
}

(global as any).isWindows = isWindows();

// Local imports
const execa = require('./utils/own-execa');
import * as util from '@common'; // Import from common via alias

const userConfig = require('./config/user-config');
const pathUtil = require('./utils/path-util');
const serverUtil = require('./utils/server-util');
const { getHash, asyncWrapper } = serverUtil;
const filewatch = require('./services/file-watchers/file-watch');
const thumbnailUtil = require('./services/thumbnail-query');
const { getStatAndUpdateDB } = require('./services/server-common');
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
console.log("global.isPkg:       ", (global as any).isPkg);
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

const sevenZipHelp = require('./services/seven-zip');
sevenZipHelp.init();
const { listZipContentAndUpdateDb, extractAll, extractByRange } = sevenZipHelp;

const resolveExtractedEntry = (baseOutputPath: string, entryPath: string) => {
    if (!entryPath) {
        return null;
    }
    const normalizedBase = path.resolve(baseOutputPath);
    const normalizedEntry = path.normalize(entryPath);
    const candidate = path.resolve(normalizedBase, normalizedEntry);
    return isSub(normalizedBase, candidate) ? candidate : null;
};

// Command line arguments
const portConfig = require('./config/port-config');
import { program } from 'commander';

program
    .option('-p, --port <number>', 'Specify the port', portConfig.default_http_port)
    .option('--skip-scan', 'skip initial scan for startup fasted', false)
    .option('--skip-cache-clean', 'skip initial cache clean', false)
    .option('--print-qr-code [boolean]', '', true);

program.parse(process.argv);
const options = program.opts();
const port = _.isString(options.port) ? parseInt(options.port) : options.port;
const skipScan = options.skipScan;
const skipCacheClean = options.skipCacheClean;
const printQrCode = options.printQrCode === "false" ? false : options.printQrCode;

console.log(options);

// DB import
const db = require("./models/db");
const estimateFileDb = require("./models/estimate-file-db");
const zipInfoDb = require("./models/zip-info-db");
const thumbnailDb = require("./models/thumbnail-db");
const historyDb = require("./models/history-db");
const cacheDb = require("./models/cache-db");

const watchManager = createWatchManager({
    cacheDb,
    db,
    filewatch,
    viewImgFolder: userConfig.view_img_folder,
});
const { addDirsToWatch, setUpCacheWatch, filterScanPaths } = watchManager;

// Limiters
const pLimit = require('p-limit');
const thumbnail_limit = pLimit(10);
const unzip_limit = pLimit(3);
const folder_stat_limit = pLimit(20);


const app = express();

app.use(express.static(distPath, {
    maxAge: (1000 * 3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000 * 3600).toString()
}));


const modifyResponseForChart = require('./middleware/chartResponseMiddleware');
app.use(['/api/folder/list_dir', '/api/search/search_file', '/api/info/get_all'], modifyResponseForChart);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const cookieParser = require('cookie-parser');
app.use(cookieParser());

//read etc config
const { etcConfig: loadedEtcConfig, pathConfig: loadedPathConfig } = loadConfig({
    etcConfigPath,
    pathConfigPath,
    logger,
});
let etc_config = loadedEtcConfig || {};
let path_config = loadedPathConfig;
(global as any).etc_config = etc_config;

// Internal IP
const internalIp = require('internal-ip');
async function getIP() {
    const lanIP = await internalIp.v4();
    const mobileAddress = `http://${lanIP}:${port}`;
    return mobileAddress;
}

const cleanCache = require("./services/cache-cleaner");

try {
    (global as any).sharp = require('sharp')
} catch (e) {
    logger.warn("[Warning] Did not install sharp");
    logger.warn("----------------------------------------------------------------");
}

async function init() {
    if ((global as any).isWindows) {
        const { stdout, stderr } = await execa("chcp");
        const r = new RegExp("\\d+");
        const m = r.exec(stdout);
        const charset = parseInt(m && m[0]);

        if (charset !== 65001) {
            logger.warn("Changing console encoding to utf8 in Windows language setting is recommended");
        }

        (global as any)._cmd_encoding = charset;
    }

    if (!(await isExist(indexHtmlPath))) {
        logger.warn(`[Error] No ${indexHtmlPath} for producation`);
        logger.warn("[Error] You may need to run npm run build");
    }

    const sqldb = await db.init();
    await estimateFileDb.init(sqldb);
    await thumbnailDb.init(sqldb);
    await historyDb.init(sqldb);
    await zipInfoDb.init(sqldb);

    const isPortOccupied = await serverUtil.isPortOccupied(port);
    if (isPortOccupied) {
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

        if (!skipCacheClean) {
            cleanCache(cachePath);
        }
        setUpCacheWatch();

        const will_scan = filterScanPaths(scan_path);

        printIP();

        await addDirsToWatch(will_scan);

    }).on('error', async (error: any) => {
        logger.error("[Server Init]", error.message);
        await serverUtil.suspend();
        process.exit(22);
    });
}

// Routes
app.post('/api/folder/add_file_watch', serverUtil.asyncWrapper(async (req: Request, res: Response) => {
    let filePath = req.body && req.body.filePath;
    if (!filePath || !(await isExist(filePath))) {
        logger.error("[/api/folder/add_file_watch]", filePath, "does not exist");
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    if (filewatch.isAlreadyScan(filePath)) {
        res.send({ failed: true, reason: "ALREADY SCAN" });
        return;
    }

    await addDirsToWatch([filePath]);
    res.send({ failed: false });
}));

async function printIP() {
    console.log("----------------------------------------------------------------");
    console.log(dateFormat(new Date(), "yyyy-mm-dd HH:MM"));
    console.log(`Express Server listening on port ${port}`);
    console.log("You can open ShiguReader from Browser now!");
    console.log(`http://localhost:${port}`);

    try {
        if (printQrCode) {

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


async function findZipForFolder(filePath: string) {
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

async function findLatestFileInFolder(dirPath: string, matcher: (fn: string) => boolean) {
    const entries = await pathUtil.readdirOneLevel(dirPath, { withFileTypes: true });
    if (!entries || entries.length === 0) {
        return null;
    }

    const candidatePromises = entries.map((entry: any) => folder_stat_limit(async () => {
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
        .sort((a, b: any) => (b.mTime || 0) - (a.mTime || 0));

    return sorted[0] || null;
}



const staticFileRouter = (req: Request, res: Response, next: NextFunction) => {
    const pp = req.path || "";
    if (pp && pp.includes("/api/")) {
        next();
    } else {
        if (pp.endsWith("bundle.js")) {
            res.sendFile(bundleJsPath);
        } else {
            res.setHeader('Cache-Control', 'public, max-age=3047');
            res.sendFile(indexHtmlPath);
        }
    }
}

const cors = require('cors');
app.use(cors());

app.get('/*', staticFileRouter)

//---------login-----------

const authModule = require('./routes/auth');
const authRoute = authModule.router;
const authTokenSet = authModule.tokenSet;
app.use(authRoute);

const exception_apis = [
    "/api/search/search_file",
    "/api/search/simple_search",
    "/api/file/download"
]

//check if login
app.use((req: Request, res: Response, next: NextFunction) => {
    if (!(global as any).etc_config.home_password) {
        res.cookie('login-token', 'no-need-login-token', { maxAge: 1000 * 3600 * 1 });
        next();
    } else if (exception_apis.some(e => (req.path.includes(e)))) {
        next();
    } else if (req.cookies && req.cookies["login-token"] && authTokenSet[req.cookies["login-token"]]) {
        next();
    } else {
        res.cookie('login-token', "")
        res.send({ failed: true, reason: "You need to login" });
    }
})

//-----------------thumbnail related-----------------------------------
app.post("/api/thumbnail/get_for_folder_list", asyncWrapper(async (req: Request, res: Response) => {
    let dirs = req.body && req.body.dirs;
    if (!dirs) {
        res.send({ failed: true, reason: "No Parameter" });
        return;
    }

    dirs = dirs.filter(pathUtil.estimateIfFolder);

    const dirThumbnails = await thumbnailUtil.getThumbnailForFolders(dirs);
    res.send({ failed: false, dirThumbnails });
}));



app.all("/api/thumbnail/get", asyncWrapper(async (req: Request, res: Response) => {
    const body = req.body || {};
    const filePath = body.filePath;
    const quickFlagFromBody = body.quick === true;
    const isQuickRequest = quickFlagFromBody;
    const allowVideoPreviewForFolder = body.allowVideoPreviewForFolder !== false;

    if (!filePath || !(await isExist(filePath))) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }

    const applyCacheHeader = () => {
        res.setHeader('Cache-Control', 'public, max-age=30');
    }

    const quickResult = await thumbnailUtil.getQuickThumbnail(filePath);
    if (quickResult && quickResult.url) {
        if (!allowVideoPreviewForFolder && quickResult.useVideoPreviewForFolder) {
            // 继续执行后续逻辑，避免返回视频预览
        } else {
            applyCacheHeader();
            res.send({
                url: quickResult.url,
                useVideoPreviewForFolder: quickResult.useVideoPreviewForFolder,
            });
            return;
        }
    }

    if (isQuickRequest) {
        res.send({ failed: true, reason: "NOT FOUND FOR QUICK" });
        return;
    }

    if (isCompress(filePath)) {
        extractThumbnailFromZip(filePath, res);
    } else if (estimateIfFolder(filePath)) {
        const zipRows = await findZipForFolder(filePath);
        if (zipRows[0]) {
            extractThumbnailFromZip(zipRows[0].filePath, res);
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
        } else {
            res.send({ failed: true, reason: "No file found" });
        }
    } else if (isImage(filePath)) {
        res.send({
            url: filePath,
            debug: "direct image"
        });
    } else {
        res.send({ failed: true, reason: "Unsupported file type" });
    }
}));


app.post("/api/thumbnail/get_for_tag", asyncWrapper(async (req: Request, res: Response) => {
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
    if (temp) {
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

const thumbnailGenerator = require("./services/thumbnail-generator");
//the only required parameter is filePath
let extractThumbnailFromZip: any = async (filePath: string, res: Response, mode: string, config: any) => {
    if (!util.isCompress(filePath)) {
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    let sendable = !isPregenerateMode && !!res;
    const outputPath = path.join(cachePath, getHash(filePath));
    const normalizedConfig = config || {};
    const onSuccess = typeof normalizedConfig.onSuccess === "function" ? normalizedConfig.onSuccess : null;

    function sendImage(imgFp: string) {
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

    function sendError(reason: string) {
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
            let reason = "[extractThumbnailFromZip] no img in this file " + filePath;
            console.log(reason);
            sendError(reason)
            return;
        }


        //解压
        const stderrForThumbnail = await extractByRange(filePath, outputPath, [thumbInnerPath])
        if (stderrForThumbnail === "NEED_TO_EXTRACT_ALL") {
            const SMALL_SIZE = 100 * 1000 * 1000;
            if (zipInfo.info.totalSize < SMALL_SIZE) {
                const { pathes, error } = await extractAll(filePath, outputPath, false);
                if (error) {
                    throw error
                } else {
                    thumbInnerPath = serverUtil.chooseThumbnailImage(pathes);
                }
            } else {
                let extensions = zipInfo.files.filter(isImage).map(path.extname).map((e: string) => "*" + e);
                extensions = _.unique(extensions);
                console.assert(extensions.length > 0)
                const { error, pathes } = await sevenZipHelp.extractByExtension(filePath, outputPath, extensions)
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
        if (e && e.toString() !== "NEED_TO_EXTRACT_ALL") {
            logger.error("[extractThumbnailFromZip] exception ", filePath, e);
        }
        const reason = e || "TBD";
        sendError(String(reason))
    }
}

function withLimit(fn: any) {
    return function (...args: any[]) {
        return thumbnail_limit(() => fn(...args));
    };
}
extractThumbnailFromZip = withLimit(extractThumbnailFromZip)


//  a huge back ground task
//  it generate all thumbnail and will be slow
let pregenerateThumbnails_lock = false;
app.post('/api/pregenerateThumbnails', asyncWrapper(async (req: Request, res: Response) => {
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
    if (pregenerateThumbnailPath == "All_Pathes") {
        totalFiles = await db.getAllFilePathes("WHERE isCompress");
    } else {
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


async function getZipWithSameFileName(filePath: string) {
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
            return null;
        }
    }

    return filePath;
}

const current_extract_queue: Record<string, string> = {};
const extract_result_cache: Record<string, any> = {};
app.post('/api/extract/extract_zip', asyncWrapper(async (req: Request, res: Response) => {
    let filePath = req.body && req.body.filePath;
    const startIndex = (req.body && req.body.startIndex) || 0;
    let stat;
    if (!filePath) {
        res.send({ failed: true, reason: "No parameter" });
        return;
    }

    if (!isCompress(filePath)) {
        res.send({ failed: true, reason: "not a zip" });
        return;
    }

    //todo: record the timestamp of each request
    //when cleaning cache, if the file is read recently, dont clean its cache
    const newFilePath = await getZipWithSameFileName(filePath);
    if (!newFilePath) {
        res.send({ failed: true, reason: "NOT FOUND" });
        return;
    }
    filePath = newFilePath;

    // const time1 = getCurrentTime();

    async function sendBack(contentObj: any, path: string, stat: any) {
        const { files, musicFiles, videoFiles } = contentObj

        const tempFiles = files.filter((e: string) => {
            return !isHiddenFile(e);
        });
        // let zipInfo;
        // if (tempFiles.length > 0) {
        //     const zipInfoRows = zipInfoDb.getZipInfo(files);
        //     zipInfo = zipInfoRows[0];
        // }
        let zipInfo = zipInfoDb.getZipInfo(filePath)[0];

        // TODO dirs留空。
        let result = { imageFiles: tempFiles, musicFiles, videoFiles, path, outputPath, stat, zipInfo, dirs: [] };
        extract_result_cache[filePath] = result;
        result = serverUtil.checkOneBookRes(result);
        res.send(result);

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
    if (extract_result_cache[filePath]) {
        res.send(extract_result_cache[filePath]);
        return;
    }


    let hasDuplicate = false;
    async function _extractAll_() {
        const { pathes, error } = await extractAll(filePath, outputPath, hasDuplicate);
        if (!error && pathes) {
            const contentUrls = splitFilesByType(pathes, outputPath);
            sendBack(contentUrls, filePath!, stat);
        } else {
            throw "fail to extract all"
        }
    }

    const full_extract_max = 10;
    try {
        stat = await getStatAndUpdateDB(filePath);
        if (current_extract_queue[filePath] === "in_progress") {
            res.send({ failed: true, reason: "extract_in_progress" });
            return;
        }
        current_extract_queue[filePath] = "in_progress";

        let { files, fileInfos } = await listZipContentAndUpdateDb(filePath);
        // let hasMusic = files.some(e => isMusic(e));
        // let hasVideo = files.some(e => isVideo(e));
        const imgfiles = files.filter((e: string) => isImage(e));
        const musicFiles = files.filter((e: string) => isMusic(e));
        const videoFiles = files.filter((e: string) => isVideo(e));
        if (files.length === 0) {
            throw `${filePath} has no content`
        }

        const fnInZip = files.map((e: string) => path.basename(e));
        hasDuplicate = util.hasDuplicate(fnInZip);
        const shouldExtractFull = files.length <= full_extract_max || hasDuplicate;

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
            let secondRange = tempfiles.filter((e: string) => {
                return !firstRange.includes(e);
            })
            secondRange = [...secondRange, ...videoFiles];
            const totalRange = [...firstRange, ...secondRange];

            const stderr = await unzip_limit(() => extractByRange(filePath, outputPath, firstRange));
            if (!stderr) {
                const resolvedOutputPath = path.resolve(outputPath);
                // 将压缩包内的相对路径转为绝对路径，同时过滤掉不合法的项目
                const unzipOutputPathes = totalRange
                    .map((e: string) => resolveExtractedEntry(outputPath, e))
                    .filter(Boolean);
                const contentUrls = splitFilesByType(unzipOutputPathes, resolvedOutputPath);
                sendBack(contentUrls, filePath!, stat);
                // const time2 = getCurrentTime();
                // const timeUsed = (time2 - time1);
                // console.log(`[/api/extract/extract_zip] FIRST PART UNZIP ${filePath} : ${timeUsed}ms`);

                await extractByRange(filePath, outputPath, secondRange);
            } else {
                if (stderr === "NEED_TO_EXTRACT_ALL") {
                    await unzip_limit(_extractAll_);
                } else {
                    throw stderr;
                }
            }
        }
    } catch (e) {
        res.send({ failed: true, reason: String(e) });
        logger.error('[/api/extract/extract_zip] exit: ', e);
    } finally {
        current_extract_queue[filePath] = "done"
    }
}));

let server_ip: string;
app.get('/api/getGeneralInfo', asyncWrapper(async (req: Request, res: Response) => {
    let os = (global as any).isWindows ? "windows" : "linux";
    if (!server_ip) {
        server_ip = await getIP();
    }

    const result = {
        server_os: os,
        file_path_sep: path.sep,
        has_magick: (global as any)._has_magick_,
        server_ip,

        good_folder: (global as any).good_folder,
        not_good_folder: (global as any).not_good_folder,
        good_folder_root: (global as any).good_folder_root,
        not_good_folder_root: (global as any).not_good_folder_root,

        move_pathes: (global as any).move_pathes,
        recentAccess: (global as any).recentAccess,
        downloadFolder: (global as any).downloadFolder
    };
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.send(result)
}));


const homepagePathRoute = require("./routes/homepage-path");
app.use(homepagePathRoute);

const historyRoute = require("./routes/history");
app.use(historyRoute);

const listDirRoute = require("./routes/list-dir").default;
app.use(listDirRoute);

const authorNamesRoute = require("./routes/author-names");
app.use(authorNamesRoute);

const fileMoveDeleteRoute = require("./routes/file-move-delete");
app.use(fileMoveDeleteRoute);

const fileDownloadRoute = require("./routes/file-download");
app.use(fileDownloadRoute);

const searchRoute = require("./routes/search").default;
app.use(searchRoute);


const allInfoRoute = require("./routes/all-info");
app.use(allInfoRoute);

const hentaiApiRoute = require("./routes/hentai-api");
app.use(hentaiApiRoute);

const cacheInfoRoute = require("./routes/cache-info");
app.use(cacheInfoRoute);

const systemShutdownRoute = require("./routes/system-shutdown");
app.use(systemShutdownRoute);

const zipMinifyRoute = require("./routes/zip-minify");
app.use(zipMinifyRoute);

// const ehentaiMetadata = require("./routes/ehentaiMetadata");
// app.use(ehentaiMetadata);

// const fileServer = require("./routes/fileServer");
// app.use(fileServer);

app.post('/*', (req: Request, res: Response) => {
    res.sendStatus(404);
})

init();
