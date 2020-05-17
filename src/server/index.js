const express = require('express');
const fs = require('fs');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const _ = require('underscore');
const isWindows = require('is-windows');
const internalIp = require('internal-ip');
const qrcode = require('qrcode-terminal');

const Constant = require("../constant");
const fileiterator = require('./file-iterator');
const userConfig = require('../user-config');
const util = require("../util");
const pathUtil = require("./pathUtil");
const serverUtil = require("./serverUtil");

const {
        fullPathToUrl,
        generateContentUrl,
        isExist,
} = pathUtil;
const { isImage, isCompress, isMusic, isVideo, arraySlice, getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;

//set up path
const rootPath = pathUtil.getRootPath();
const cache_folder_name = userConfig.cache_folder_name;
const cachePath = path.join(rootPath, cache_folder_name);
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd HH-MM"))+ ".log";

//set up json DB
const zipInfoDb = require("./models/zipInfoDb");
let zip_content_db_path =  path.join(rootPath,  userConfig.workspace_name, "zip_info");
zipInfoDb.init(zip_content_db_path);
const { getPageNum, getMusicNum, updateZipDb }  = zipInfoDb;

const sevenZipHelp = require("./sevenZipHelp");
const { get7zipOption , listZipContent, extractAll, extractByRange }= sevenZipHelp;


//set up user path
let home_pathes;
const path_config_path = path.join(rootPath, "src", "path-config");
//read text file 
home_pathes = fs.readFileSync(path_config_path).toString().split('\n'); 
home_pathes = home_pathes
            .map(e => e.trim().replace(/\n|\r/g, ""))
            .filter(pp =>{ return pp && pp.length > 0 && !pp.startsWith("#");});
home_pathes = _.uniq(home_pathes);
if(home_pathes.length === 0){
    if(isWindows()){
        const getDownloadsFolder = require('downloads-folder');
        home_pathes.push(getDownloadsFolder());
    }else{
        //downloads-folder cause error on unix
        home_pathes.push(`${process.env.HOME}/Downloads`);
    }
}

const path_will_scan = home_pathes.concat(userConfig.good_folder, userConfig.good_folder_root, userConfig.not_good_folder);

const isProduction = process.argv.includes("--production");

console.log("--------------------");
console.log("process.cwd()", process.cwd());
console.log("__filename", __filename);
console.log("__dirname", __dirname);
console.log("rootPath", rootPath);
console.log("log path:", logPath);

console.log("----------------------");

const loggerModel = require("./models/logger");
loggerModel.init(logPath);
const logger = loggerModel.logger;

const db = require("./models/db");
const {getAllFilePathes, getCacheFiles, getCacheOutputPath} = db;

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

const portConfig = require('../port-config');
const {http_port, dev_express_port } = portConfig;

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

    console.log("scanning local files");

    const filter = (e, stat) => {
        const minSize = 1000 * 10;
        if(stat.size < minSize){
            return false;
        }
        return isDisplayableInExplorer(e);
    };
    let beg = (new Date).getTime()
    const results = fileiterator(path_will_scan, { 
        filter:filter, 
        doLog: true
    });
    results.pathes = results.pathes.concat(home_pathes);
    let end = (new Date).getTime();
    console.log(`${(end - beg)/1000}s  to read local dirs`);
    console.log("Analyzing local files");
    
    db.initFileToInfo(results.infos);

    console.log("There are", getAllFilePathes().length, "files");

    console.log("----------scan cache------------");
    const cache_results = fileiterator([cachePath], { 
        filter: isImage, 
        doLog: true
    });

    db.initCacheDb(cache_results.pathes, cache_results.infos);
    db.setUpFileWatch(home_pathes, cache_folder_name);

    const port = isProduction? http_port: dev_express_port;
    const server = app.listen(port, async () => {
        const lanIP = await internalIp.v4();
        const mobileAddress = `http://${lanIP}:${http_port}`;
        console.log("----------------------------------------------------------------");
        console.log(dateFormat(new Date(), "yyyy-mm-dd HH:MM"));
        console.log(`Express Server listening on port ${port}`);
        console.log("You can open ShiguReader from Browser now!");
        console.log(`http://localhost:${http_port}`);
        console.log(mobileAddress);
        console.log("Scan the QR code to open on mobile devices");
        qrcode.generate(mobileAddress);
        console.log("----------------------------------------------------------------");
    }).on('error', (error)=>{
        logger.error("[Server Init]", error.message);
        console.error("[Server Init]", error.message);

        //exit the current program
        setTimeout(()=> process.exit(22), 500);
    });
}

//----------------get folder contents

function getThumbnails(filePathes){
    const thumbnails = {};
    
    filePathes.forEach(filePath => {
        if(!isCompress(filePath)){
            return;
        }

        const outputPath = getCacheOutputPath(cachePath, filePath);
        let cacheFiles = getCacheFiles(outputPath);
        cacheFiles = (cacheFiles && cacheFiles.files) || [];
        const thumb = serverUtil.chooseThumbnailImage(cacheFiles);
        if(thumb){
            thumbnails[filePath] = fullPathToUrl(thumb);
        }else if(zipInfoDb.has(filePath)){
            const pageNum = getPageNum(filePath);
            if(pageNum === 0){
                thumbnails[filePath] = "NOT_THUMBNAIL_AVAILABLE";
            }
        }
    }); 
    return thumbnails;
}


serverUtil.common.path_will_scan = path_will_scan;
serverUtil.common.getCacheOutputPath = getCacheOutputPath;
serverUtil.common.cachePath = cachePath;
serverUtil.common.getThumbnails = getThumbnails;

//-----------------thumbnail related-----------------------------------

app.post(Constant.TAG_THUMBNAIL_PATH_API, (req, res) => {
    const author = req.body && req.body.author;
    const tag = req.body && req.body.tag;
    if (!author && !tag) {
        res.sendStatus(404);
        return;
    }

    const { files } = searchByTagAndAuthor(tag, author, null, true);
    chosendFileName = serverUtil.chooseOneZipForOneTag(files, fileToInfo);
    if(!chosendFileName){
        res.sendStatus(404);
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
        console.log(`${prefix} ${(secPerFile).toFixed(2)} seconds per file`);
        console.log(`${prefix} ${remainTime.toFixed(2)} minutes before finish`);
    }
    if(minCounter >= total){
        console.log('[pregenerate] done');
    }
}


const pLimit = require('p-limit');
const extractlimit = pLimit(1);
const minifyImageFile = require("../tools/minifyImageFile");
//the only required parameter is filePath
async function extractThumbnailFromZip(filePath, res, mode, config) {
    if(!util.isCompress(filePath)){
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    const sendable = !isPregenerateMode && res;
    const outputPath = getCacheOutputPath(cachePath, filePath);
    let files;
 
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

    function handleFail(){
        sendable && res.sendStatus(404);
        if(isPregenerateMode){
            config.total--;
        }
    }

    function minify(one){
        minifyImageFile(outputPath, path.basename(one), (err, info) => { 
            if(isPregenerateMode){
                config.minCounter++;
                logForPre("[pre-generate minify] ", config, filePath );
            }
         });
    }

    //only update zip db
    //do not use zip db's information
    //in case previous info is changed or wrong
    if(isPregenerateMode){
        //in pregenerate mode, it always updates db content
        files = await listZipContent(filePath);
    }

    //check if there is compress thumbnail  e.g thumbnail--001.jpg
    const cacheFiles = getCacheFiles(outputPath);
    if (cacheFiles && cacheFiles.files.length > 0) {
        const tempOne =  serverUtil.chooseThumbnailImage(cacheFiles.files);
        if(util.isCompressedThumbnail(tempOne)){
            let temp = path.join(outputPath, path.basename(tempOne));
            sendImage(temp);
            if(isPregenerateMode){
                config.minCounter++;
                logForPre("[pre-generate minify] ", config, filePath);
            }
        } else if(isPregenerateMode){
            minify(tempOne);
        }
    } else {
        //do the extract
        try{
            if(!files){
                files = await listZipContent(filePath);
            } 
            const one = serverUtil.chooseThumbnailImage(files);
            if(!one){
                // console.error("[extractThumbnailFromZip] no thumbnail for ", filePath);
                handleFail();
            } else {
                const stderrForThumbnail = await  extractByRange(filePath, outputPath, [one])
                if (!stderrForThumbnail) {
                    // send path to client
                    let temp = path.join(outputPath, path.basename(one));
                    sendImage(temp);
                    minify(one)
                    if(isPregenerateMode){
                        config.counter++;
                    }
                } else {
                    console.error("[extractThumbnailFromZip extract exec failed]", code);
                    handleFail();
                }
            }
        } catch(e) {
            console.error("[extractThumbnailFromZip] exception", filePath,  e);
            logger.error("[extractThumbnailFromZip] exception", filePath,  e);
            handleFail();
        }
    }
}


//  a huge back ground task 
//  it generate all thumbnail and will be slow
app.post('/api/pregenerateThumbnails', (req, res) => {
    let path = req.body && req.body.path;
    if(!path){
        return;
    }

    const allfiles = getAllFilePathes();
    let totalFiles = allfiles.filter(isCompress);
    if(path !== "All_Pathes"){
        totalFiles = totalFiles.filter(e => e.includes(path));
    }

    let config = {counter: 0, 
                  minCounter: 0,
                  total: totalFiles.length, 
                  pregenBeginTime: getCurrentTime()};
    totalFiles.forEach(filePath =>{
        extractThumbnailFromZip(filePath, res, "pre-generate", config);
    })
});


//! !need to set windows console to utf8
app.post('/api/firstImage', async (req, res) => {
    const filePath = req.body && req.body.filePath;

    if (!filePath || !(await isExist(filePath))) {
        res.sendStatus(404);
        return;
    }
    extractThumbnailFromZip(filePath, res);
});

app.post('/api/extract', async (req, res) => {
    let filePath =  req.body && req.body.filePath;
    const startIndex = (req.body && req.body.startIndex) || 0;
    if (!filePath) {
        res.sendStatus(404);
        return;
    }

    //potential bug:
    // if in one zip there are 01/001.jpg and 01/002.jpg 
    // this will only only extract one, because they overwrite each other

    //todo: record the timestamp of each request
    //when cleaning cache, if the file is read recently, dont clean its cache

    if(!(await isExist(filePath))){
        //maybe the file move to other location
        const baseName = path.basename(filePath);
        //todo loop is slow
        const isSomewhere = getAllFilePathes().some(e => {
            if(e.endsWith(baseName)){
                filePath = e;
                return true;
            }
        });

        if(!isSomewhere){
            res.sendStatus(404);
            return;
        }
    }
    
    const time1 = getCurrentTime();
    const stat = await pfs.stat(filePath);

    function sendBack(files, musicFiles, path, stat){
        const tempFiles =  serverUtil.filterHiddenFile(files);
        res.send({ files: tempFiles, musicFiles,path, stat });
    }

    const outputPath = getCacheOutputPath(cachePath, filePath);
    const temp = getCacheFiles(outputPath);

    if(zipInfoDb.has(filePath)  && temp ){
        const pageNum = getPageNum(filePath); 
        const musicNum = getMusicNum(filePath);
        const totalNum = pageNum + musicNum;
        const _files = (temp.files||[]).filter(e => {
            return !util.isCompressedThumbnail(e);
        });

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
            let files = await listZipContent(filePath);
            files = files.filter(e => isDisplayableInOnebook(e));
            if(files.length === 0){
               res.sendStatus(404);
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
                    res.sendStatus(404);
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
                    
                    extractByRange(filePath, outputPath, secondRange)
                } else {
                    res.sendStatus(500);
                    console.error('[/api/extract] exit: ', stderr);
                }
            }
       } catch (e){
            res.sendStatus(500);
            console.error('[/api/extract] exit: ', e);
            logger.error('[/api/extract] exit: ', e);
        }
    })();
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

if(isProduction){
    const history = require('connect-history-api-fallback');
    app.use(history({
        verbose: true,
    }));

    app.get('/index.html', (req, res) => {
        const as = path.resolve(__dirname, "..", "..", 'dist', 'index.html');
        res.sendFile(as);
    })
}

init();
