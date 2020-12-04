const express = require('express');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const _ = require('underscore');
const isWindows = require('is-windows');
const qrcode = require('qrcode-terminal');

global.requireUtil = function(e) {
    return require("../common/util")
};

global.requireUserConfig = function() {
    return require("../config/user-config")
};

global.requireConstant = function(){
    return require("../common/constant");
}

const userConfig = global.requireUserConfig();
const util = global.requireUtil();

const fileiterator = require('./file-iterator');
const pathUtil = require("./pathUtil");
const serverUtil = require("./serverUtil");
const { isHiddenFile } = serverUtil;

const { fullPathToUrl, generateContentUrl, isExist,  getHomePath } = pathUtil;
const { isImage, isCompress, isMusic, arraySlice, 
        getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook, escapeRegExp } = util;

//set up path
const rootPath = pathUtil.getRootPath();
const { cache_folder_name, thumbnail_folder_name, view_img_folder } = userConfig
const cachePath = path.join(rootPath, cache_folder_name);
const thumbnailFolderPath = path.join(rootPath, thumbnail_folder_name);
global.cachePath = cachePath;


//set up user path

const isProduction = process.argv.includes("--production");

// console.log("--------------------");
// console.log("process.cwd()", process.cwd());
// console.log("__filename", __filename);
// console.log("__dirname", __dirname);
// console.log("rootPath", rootPath);
// console.log("----------------------");

const logger = require("./logger");

const searchByTagAndAuthor = require("./models/searchUtil");


//set up json DB
const zipInfoDb = require("./models/zipInfoDb");
let zip_content_db_path =  path.join(rootPath,  userConfig.workspace_name, "zip_info");
zipInfoDb.init(zip_content_db_path);
const { getPageNum, getMusicNum, deleteFromZipDb, getZipInfo }  = zipInfoDb;


const sevenZipHelp = require("./sevenZipHelp");
const { listZipContentAndUpdateDb, extractAll, extractByRange }= sevenZipHelp;

const db = require("./models/db");
const { getAllFilePathes, getCacheFiles, getCacheOutputPath, 
        updateStatToDb, deleteFromDb , updateStatToCacheDb, deleteFromCacheDb, getFileCollection} = db;

const app = express();
app.use(express.static('dist', {
    maxAge: (1000*3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000*3600*24).toString() // uses milliseconds per docs
}));
//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

const portConfig = require('../config/port-config');
const {http_port, dev_express_port } = portConfig;

let thumbnailDb = {};

const jsonfile = require('jsonfile');
let temp_json_path =  path.join(rootPath,  userConfig.workspace_name, "temp_json_info.json");


async function mkdir(path, quiet){
    if(!(await isExist(path))){
        try {
            const err = await pfs.mkdir(path, { recursive: true});
            if(err){
                throw err;
            }
        }catch(err){
            if(!quiet){
                throw err;
            }
        }
    }
}

async function init() {
    if(isWindows()){
        const {stdout, stderr} = await execa("chcp");
        console.log("[chcp]", stdout);
        const r = new RegExp("\\d+");
        const m = r.exec(stdout);
        const charset = parseInt(m && m[0]);
    
        if (charset !== 65001) {
            console.error("Please switch you console encoding to utf8 in windows language setting");
            userConfig.readable_cache_folder_name = false;
        }
    }

    let previous_history_obj;
    try{
        previous_history_obj= await jsonfile.readFile(temp_json_path)
    }catch(e){
        //do nothing since this is trivial
    }

    //统一mkdir
    await mkdir(thumbnailFolderPath);
    await mkdir(cachePath);
    await mkdir(pathUtil.getImgConverterCachePath());
    await mkdir(pathUtil.getZipOutputCachePath());

    const mkdirArr = userConfig.additional_folder.concat([userConfig.good_folder, userConfig.not_good_folder_root]);
    for(let ii = 0; ii < mkdirArr.length; ii++){
        const fp = mkdirArr[ii];
        await mkdir(fp, "quiet");
    }


    let { home_pathes, path_will_scan, path_will_watch } = await getHomePath();
    global.path_will_scan = path_will_scan;

    const cleanCache = require("../tools/cleanCache");
    cleanCache.cleanCache(cachePath);

    console.log("scanning local files");

    const estimated_total = previous_history_obj &&  
                            _.isEqual(previous_history_obj.path_will_scan, path_will_scan) && 
                            previous_history_obj.total_count;

    let beg = (new Date).getTime();

    const everything_connector = require("../tools/everything_connector");
    const scan_otption = { 
        filter: shouldWatchForNormal, 
        doLog: true,
        estimated_total,
        port: userConfig.everything_http_server_port
    };
    let results = userConfig.everything_http_server_port && 
                    isWindows() && 
                    await everything_connector.getAllFileinPath(path_will_scan, scan_otption);
    if(!results){
        results = await fileiterator(path_will_scan, scan_otption);
    }
    results.pathes = results.pathes.concat(home_pathes);
    let end1 = (new Date).getTime();
    console.log(`${(end1 - beg)/1000}s to read local dirs`);

   
    console.log("Analyzing local files");
    db.initFileToInfo(results.infos);
    const total_count =  getAllFilePathes().length;
    console.log("There are", total_count, "files");
    let end3 = (new Date).getTime();
    console.log(`${(end3 - end1)/1000}s to analyze local files`);

    try{
        previous_history_obj = {  total_count, path_will_scan  };
        await jsonfile.writeFile(temp_json_path, previous_history_obj);
    }catch(e){
        //nothing
    }

    console.log("----------scan thumbnail------------");
    end1 = (new Date).getTime();
    let thumbnail_pathes = await pfs.readdir(thumbnailFolderPath);
    thumbnail_pathes = thumbnail_pathes.filter(isImage).map(e => path.resolve(thumbnailFolderPath, e));
    end3 = (new Date).getTime();
    console.log(`${(end3 - end1)/1000}s  to read thumbnail dirs`);
    initThumbnailDb(thumbnail_pathes);

    //todo: chokidar will slow the server down very much when it init async
    setUpFileWatch(path_will_watch);

    try{
        const machineLearning = require("./models/machineLearning");
        machineLearning.init();
    }catch(e){
        console.error(e);
    }

    const port = isProduction? http_port: dev_express_port;
    const server = app.listen(port, async () => {
        console.log("----------------------------------------------------------------");
        console.log(dateFormat(new Date(), "yyyy-mm-dd HH:MM"));
        console.log(`Express Server listening on port ${port}`);
        console.log("You can open ShiguReader from Browser now!");
        console.log(`http://localhost:${http_port}`);
        
        try{
            const internalIp = require('internal-ip');
            const lanIP = await internalIp.v4();
            const mobileAddress = `http://${lanIP}:${http_port}`;
            console.log(mobileAddress);
            console.log("Scan the QR code to open on mobile devices");
            qrcode.generate(mobileAddress);
        }catch(e){
        
        }
        console.log("----------------------------------------------------------------");
    }).on('error', (error)=>{
        logger.error("[Server Init]", error.message);

        //exit the current program
        setTimeout(()=> process.exit(22), 500);
    });
}

function addToThumbnailDb(filePath){
    const key = path.basename(filePath, path.extname(filePath));
    thumbnailDb[key] = filePath;
}

function initThumbnailDb(filePath){
    filePath.forEach(e => {
        addToThumbnailDb(e);
    })
}

function getThumbnailFromThumbnailFolder(outputPath){
    const key = path.basename(outputPath);
    return thumbnailDb[key];
}

function getThumbCount(){
    return _.keys(thumbnailDb).length;
}

global.getThumbCount = getThumbCount;

function getExt(p){
    const ext = path.extname(p).toLowerCase();
    //xxx NO.003 xxx is not meaningful extension
    //extension string should be alphabet(may with digit), but not only digit
    if(ext && /^\.[a-zA-z0-9]*$/.test(ext) && !/^\.[0-9]*$/.test(ext)){
        return ext;
    }else{
        return "";
    }
}

//this function which files will be scanned and watched by ShiguReader
function shouldWatchForNormal(p){
    if(isHiddenFile(p)){
        return false;
    }
    const ext = getExt(p);
    //not accurate, but performance is good. access each file is very slow
    const isFolder = !ext; 
    let result = isFolder  ||  isDisplayableInExplorer(ext);

    if(view_img_folder){
        result = result ||  isDisplayableInOnebook(ext)
    }
    return  result;
}

function shouldIgnoreForNormal(p){
    return !shouldWatchForNormal(p);
}

function shouldIgnoreForCache(p){
    return !shouldWatchForCache(p);
}

function shouldWatchForCache(p){
    if(isHiddenFile(p)){
        return false;
    }
    const ext = getExt(p);
    return !ext ||  isDisplayableInOnebook(ext);
}


const chokidar = require('chokidar');
function setUpFileWatch (path_will_scan){
    //watch file change 
    //update two database
    const watcher = chokidar.watch(path_will_scan, {
        ignored: shouldIgnoreForNormal,
        ignoreInitial: true,
        persistent: true,
        ignorePermissionErrors: true
    });

    const addCallBack = (path, stats) => {
        serverUtil.parse(path);
        updateStatToDb(path, stats);
        
        if(isCompress(path) && stats.size > 1*1024*1024){
            //do it slowly to avoid the file used by the other process
            //this way is cheap than the really detection
            setTimeout(()=>{
                listZipContentAndUpdateDb(path);
            }, 3000);
        }
    };

    const deleteCallBack = path => {
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
            const fp =  path.dirname(p);
            db.cacheDb.folderToFiles[fp];
        });

    cacheWatcher
        .on('add', (p, stats) => {
            updateStatToCacheDb(p, stats);
        })
        .on('unlink', p => {
            deleteFromCacheDb(p);
        });

    return {
        watcher,
        cacheWatcher
    };
}


function getThumbnails(filePathes){
    const thumbnails = {};
    
    filePathes.forEach(filePath => {
        if(!isCompress(filePath)){
            return;
        }

        const outputPath = getCacheOutputPath(cachePath, filePath);
        let thumb = getThumbnailFromThumbnailFolder(outputPath);
        if(thumb){
            thumbnails[filePath] = fullPathToUrl(thumb);
        }else{
            let cacheFiles = getCacheFiles(outputPath);
            cacheFiles = (cacheFiles && cacheFiles.files) || [];
            thumb = serverUtil.chooseThumbnailImage(cacheFiles);
            if(thumb){
                thumbnails[filePath] = fullPathToUrl(thumb);
            }else if(zipInfoDb.has(filePath)){
                const pageNum = getPageNum(filePath);
                if(pageNum === 0){
                    thumbnails[filePath] = "NOT_THUMBNAIL_AVAILABLE";
                }
            }
        }
    }); 
    return thumbnails;
}

async function getStat(filePath){
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
        res.send({failed: true, reason: "No Parameter"});
        return;
    }

    const onlyNeedFew = true;
    const { fileInfos } = searchByTagAndAuthor(tag, author, null, onlyNeedFew);
    const files = _.keys(fileInfos);
    chosendFileName = serverUtil.chooseOneZipForOneTag(files, db.getFileToInfo());
    if(!chosendFileName){
        res.send({failed: true, reason: "No file found"});
        return;
    }

    extractThumbnailFromZip(chosendFileName, res);
});

function logForPre(prefix, config, filePath) {
    const {minCounter, total} = config;
    console.log(`${prefix} ${minCounter}/${total}  ${filePath}`);
    const time2 = getCurrentTime();
    const timeUsed = (time2 - config.pregenBeginTime)/1000;
    if(minCounter > 0){
        const secPerFile = timeUsed /minCounter;
        const remainTime = (total - minCounter) * secPerFile/60;
        console.log(`${prefix} ${(secPerFile).toFixed(2)} seconds per file.     ${remainTime.toFixed(2)} minutes before finish`);
    }
    if(minCounter >= total){
        console.log('[pregenerate] done');
    }
}

const thumbnailGenerator = require("../tools/thumbnailGenerator");
//the only required parameter is filePath
async function extractThumbnailFromZip(filePath, res, mode, config) {
    if(!util.isCompress(filePath)){
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    const sendable = !isPregenerateMode && res;
    const outputPath = getCacheOutputPath(cachePath, filePath);
    let files, temp;
 
    function sendImage(img){
        let ext = path.extname(img);
        ext = ext.slice(1);
        // !send by image. no able to use cache
        // sendable && res.setHeader('Content-Type', 'image/' + ext );
        // sendable && res.sendFile(path.resolve(img));
        sendable && res.send({
            url: fullPathToUrl(img)
        })
    }

    function handleFail(reason){
        reason = reason || "NOT FOUND";
        sendable && res.send({failed: true, reason: reason});
        if(isPregenerateMode){
            config.total--;
        }
    }

    async function minify(one){
        const outputFilePath = await thumbnailGenerator(thumbnailFolderPath, outputPath, path.basename(one));
        if(outputFilePath){
            addToThumbnailDb(outputFilePath);
            if(isPregenerateMode){
                config.minCounter++;
                logForPre("[pre-generate minify] ", config, filePath );
            }
         }
    }

    //only update zip db
    //do not use zip db's information
    //in case previous info is changed or wrong
    if(isPregenerateMode){
        if(config.fastUpdateMode && zipInfoDb.has(filePath)){
            //skip
        }else{
            //in pregenerate mode, it always updates db content
            temp = await listZipContentAndUpdateDb(filePath);
            files = temp.files;
        }
    }

    const thumbnail = getThumbnailFromThumbnailFolder(outputPath);
    if (thumbnail) {
        sendImage(thumbnail);
        if(isPregenerateMode){
            config.minCounter++;
            logForPre("[pre-generate minify] ", config, filePath);
        }
    } else {
        //do the extract
        try{
            if(!files){
                temp = await listZipContentAndUpdateDb(filePath);
                files = temp.files;
            } 
            const one = serverUtil.chooseThumbnailImage(files);
            if(!one){
                // console.error("[extractThumbnailFromZip] no thumbnail for ", filePath);
                handleFail("no img in file");
            } else {
                const stderrForThumbnail = await extractByRange(filePath, outputPath, [one])
                if (!stderrForThumbnail) {
                    // send path to client
                    let temp = path.join(outputPath, path.basename(one));
                    sendImage(temp);
                    await minify(one)
                    if(isPregenerateMode){
                        config.counter++;
                    }
                } else {
                    console.error("[extractThumbnailFromZip extract exec failed]", stderrForThumbnail);
                    handleFail("extract exec failed");
                }
            }
        } catch(e) {
            console.error("[extractThumbnailFromZip] exception", filePath,  e);
            handleFail(e);
        }
    }
}


//  a huge back ground task 
//  it generate all thumbnail and will be slow

let pregenerateThumbnails_lock = false;

app.post('/api/pregenerateThumbnails', async (req, res) => {
    let path = req.body && req.body.path;
    if(!path){
        res.send({failed: true, reason: "NOT PATH"});
        return;
    }else if(pregenerateThumbnails_lock){
        res.send({failed: true, reason: "Already Running"});
        return;
    }

    pregenerateThumbnails_lock = true;

    const fastUpdateMode = req.body && req.body.fastUpdateMode;

    const allfiles = getAllFilePathes();
    let totalFiles = allfiles.filter(isCompress);
    if(path !== "All_Pathes"){
        totalFiles = totalFiles.filter(e => e.includes(path));
    }

    let config = {counter: 0, 
                  minCounter: 0,
                  total: totalFiles.length, 
                  fastUpdateMode,
                  pregenBeginTime: getCurrentTime()};

    
    const thumbnailNum = getThumbCount();
    if(thumbnailNum / totalFiles.length > 0.3){
        totalFiles = _.shuffle(totalFiles);
    }

    res.send({failed: false});

    console.log("begin pregenerateThumbnails")

    try{
        for(let ii = 0; ii < totalFiles.length; ii++){
            const filePath = totalFiles[ii];
            await extractThumbnailFromZip(filePath, null, "pre-generate", config);
        }
    }catch(e){

    }finally{
        pregenerateThumbnails_lock = false;
    }
});


//! !need to set windows console to utf8
app.post('/api/firstImage', async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.send({failed: true, reason: "NOT FOUND"});
        return;
    }
    extractThumbnailFromZip(filePath, res);
});

app.post('/api/extract', async (req, res) => {
    let filePath =  req.body && req.body.filePath;
    const startIndex = (req.body && req.body.startIndex) || 0;
    if (!filePath) {
        res.send({failed: true, reason: "No parameter"});
        return;
    }

    //potential bug:
    // if in one zip there are 01/001.jpg and 01/002.jpg 
    // this will only only extract one, because they overwrite each other

    //todo: record the timestamp of each request
    //when cleaning cache, if the file is read recently, dont clean its cache

    if(!(await isExist(filePath))){
        //maybe the file move to other location
        const fn = path.basename(filePath);
        //todo loop is slow
        const sameFnObj = getFileCollection().findOne({fileName: fn });
        if(sameFnObj){
            filePath = sameFnObj.filePath;
        } else {
            res.send({failed: true, reason: "NOT FOUND"});
            return;
        }
    }
    
    const time1 = getCurrentTime();
    const stat = await getStat(filePath);
 

    function sendBack(files, musicFiles, path, stat){
        const tempFiles =  files.filter(e => {
            return !isHiddenFile(e);
          });
        let zipInfo;
        if(tempFiles.length > 0){
            zipInfo = getZipInfo([path])[path];
        }
        res.send({ files: tempFiles, musicFiles, path, stat, zipInfo });
    }

    const outputPath = getCacheOutputPath(cachePath, filePath);
    const temp = getCacheFiles(outputPath);

    if(zipInfoDb.has(filePath)  && temp ){
        const pageNum = getPageNum(filePath); 
        const musicNum = getMusicNum(filePath);
        const totalNum = pageNum + musicNum;
        const _files = temp.files||[];

        if (totalNum > 0 &&  _files.length >= totalNum) {
            sendBack(temp.files, temp.musicFiles, filePath, stat);
            return;
        }else if(totalNum === 0){
            sendBack([], [], filePath, stat );
            return;
        }
    }

    (async () => {
        const full_extract_max = 10;
        try{
            let { files, fileInfos } = await listZipContentAndUpdateDb(filePath);
            files = files.filter(e => isDisplayableInOnebook(e));
            if(files.length === 0){
               res.send({failed: true, reason: "has no content"});
               console.error(`[/api/extract] ${filePath} has no content`);
               return;
            }

            let hasMusic = files.some(e => isMusic(e));
            if(hasMusic || files.length <= full_extract_max){
                const { pathes, error } = await extractAll(filePath, outputPath);
                if(!error && pathes){
                    const temp = generateContentUrl(pathes, outputPath);
                    sendBack(temp.files, temp.musicFiles, filePath, stat);
                } else {
                    res.send({failed: true, reason: "fail to extract"});
                }
            }else{
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
                if(firstRange.length + secondRange.length !== files.length){
                    throw "arraySlice wrong";
                }

                let stderr = await extractByRange(filePath, outputPath, firstRange)
                if (!stderr) {
                    const temp = generateContentUrl(files, outputPath);
                    sendBack(temp.files, temp.musicFiles, filePath, stat);
                    const time2 = getCurrentTime();
                    const timeUsed = (time2 - time1);
                    console.log(`[/api/extract] FIRST PART UNZIP ${filePath} : ${timeUsed}ms`);
                    
                    await extractByRange(filePath, outputPath, secondRange)
                } else {
                    res.send({failed: true, reason: stderr});
                    console.error('[/api/extract] exit: ', stderr);
                }
            }
       } catch (e){
            res.send({failed: true, reason: e});
            console.error('[/api/extract] exit: ', e);
        }
    })();
});

app.post('/api/getGeneralInfo', async (req, res) => {
    let os = isWindows()? "windows": "linux";

    const result = {
      server_os: os,
       file_path_sep: path.sep
    };

    let folderArr = [userConfig.good_folder, userConfig.not_good_folder].concat(userConfig.additional_folder);

    //dulicate code as /api/homePagePath
    folderArr = folderArr.filter(e => {
        if(e){
            const reg = escapeRegExp(e);
            //check if pathes really exist by checking there is file in the folder
            return !!getFileCollection().findOne({'filePath': { '$regex' : reg }, isDisplayableInExplorer: true });
        }
    })

    result.good_folder = folderArr.includes(userConfig.good_folder)? userConfig.good_folder : "";
    result.not_good_folder = folderArr.includes(userConfig.not_good_folder)?  userConfig.not_good_folder : "";
    result.additional_folder = folderArr;

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

const ehentaiMetadata = require("./routes/ehentaiMetadata") ;
app.use(ehentaiMetadata);


if(isProduction){
    const history = require('connect-history-api-fallback');
    app.use(history({
        // verbose: true,
    }));

    app.get('/index.html', (req, res) => {
        const as = path.resolve(__dirname, "..", "..", 'dist', 'index.html');
        res.sendFile(as);
    })
}

init();
