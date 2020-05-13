const express = require('express');
const fs = require('fs');
const path = require('path');
const stringHash = require("string-hash");
const chokidar = require('chokidar');
const execa = require('execa');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');

const _ = require('underscore');

const Constant = require("../constant");
const fileiterator = require('./file-iterator');
const nameParser = require('../name-parser');
const userConfig = require('../user-config');
const util = require("../util");
const pathUtil = require("./pathUtil");
const serverUtil = require("./serverUtil");
const internalIp = require('internal-ip');
const qrcode = require('qrcode-terminal');

const {
        fullPathToUrl,
        turnPathSepToWebSep,
        generateContentUrl,
        isExist,
        isDirectParent,
        isSub
} = pathUtil;
const { isImage, isCompress, isMusic, isVideo, arraySlice, getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;

const rootPath = pathUtil.getRootPath();
const cache_folder_name = userConfig.cache_folder_name;
const cachePath = path.join(rootPath, cache_folder_name);
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd HH-MM"))+ ".log";

//set up json DB
const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
let zip_content_db_path =  path.join(rootPath,  userConfig.workspace_name, "zip_info");
const zip_content_db = new JsonDB(new Config(zip_content_db_path, true, true, '/'));

//set up user path
var isLinux = require('is-linux'),
    isOsx = require('is-osx'),
    isWindows = require('is-windows'),
    cp = require('child_process');

const path_config_path = path.join(rootPath, "src", "path-config");
let home_pathes = fs.readFileSync(path_config_path).toString().split('\n');
home_pathes = home_pathes
               .map(e => e.trim().replace(/\n|\r/g, ""))
               .filter(pp =>{ return pp && pp.length > 0 && !pp.startsWith("#");});

if(isWindows()){
    const getDownloadsFolder = require('downloads-folder');
    home_pathes.push(getDownloadsFolder());
}else{
    //downloads-folder cause error on unix
    home_pathes.push(`${process.env.HOME}/Downloads`);
}

const path_will_scan = home_pathes.concat(userConfig.good_folder, userConfig.good_folder_root, userConfig.not_good_folder);

// console.log("process.argv", process.argv);
const isProduction = process.argv.includes("--production");

console.log("--------------------");
console.log("process.cwd()", process.cwd());
console.log("__filename", __filename);
console.log("__dirname", __dirname);
console.log("rootPath", rootPath);
console.log("log path:", logPath);

let sevenZip;
if(isWindows()){
    const sevenZipPath = path.join(process.cwd(), "resource/7zip");
    sevenZip = require(sevenZipPath)['7z'];
    console.log("sevenZipPath", sevenZipPath);
}else{
    //assume linux/mac people already install it by cmd
    //https://superuser.com/questions/548349/how-can-i-install-7zip-so-i-can-run-it-from-terminal-on-os-x
    sevenZip = "7z";
}

console.log("----------------------");

const loggerModel = require("./models/logger");
loggerModel.init(logPath);
const logger = loggerModel.logger;

function parse(str){
    return nameParser.parse(path.basename(str, path.extname(str)));
}

const includesWithoutCase =  nameParser.includesWithoutCase;

function updateTagHash(str){
    const result = parse(str);
    if(result){
        result.tags.forEach(tag => {
            db.hashTable[stringHash(tag)] = tag;
        });

        if(result.author){
            db.hashTable[stringHash(result.author)] = result.author;
        }
    }
}

const getCacheOutputPath = function (cachePath, zipFilePath) {
    let outputFolder;
    outputFolder = path.basename(zipFilePath, path.extname(zipFilePath));
    if(!userConfig.readable_cache_folder_name){
        outputFolder = stringHash(zipFilePath).toString();
    }else{
        outputFolder = outputFolder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>/]/gi, '');
    }
    outputFolder = outputFolder.trim();

    let stat = db.getFileToInfo()[zipFilePath];
    if (!stat) {
        //should have stat in fileToInfo
        //but chokidar is not reliable
        //getCacheOutputPath comes before chokidar callback
        console.warn("[getCacheOutputPath] no stat", zipFilePath);
    } else {
        const mdate = new Date(stat.mtimeMs);
        const mstr = dateFormat(mdate, "yyyy-mm-dd");
        const fstr = (stat.size/1000/1000).toFixed();
        outputFolder = outputFolder+ `${mstr} ${fstr} `;
    }
    return path.join(cachePath, outputFolder);
}

const app = express();

const db = require("./models/db");
const getAllFilePathes = db.getAllFilePathes;

const cacheDb = {
    //a list of cache files folder -> files
    folderToFiles: {},
    //cache path to file stats
    cacheFileToInfo: {}
}

app.use(express.static('dist', {
    maxAge: (1000*3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000*3600*24).toString() // uses milliseconds per docs
}));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

// fileChangeHandler.init(app, logger);


//  outputPath is the folder name
function getCacheFiles(outputPath) {
    //in-memory is fast
    const single_cache_folder = path.basename(outputPath);
    if(cacheDb.folderToFiles[single_cache_folder] && cacheDb.folderToFiles[single_cache_folder].length > 0){
        return generateContentUrl(cacheDb.folderToFiles[single_cache_folder], outputPath);
    }
    return null;
}

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
    
    for (let i = 0; i < results.pathes.length; i++) {
        const p = results.pathes[i];
        const ext = path.extname(p).toLowerCase();
        if (!ext ||  isDisplayableInExplorer(ext)) {
            db.hashTable[stringHash(p)] = p;
            updateTagHash(p);
        }
    }

    db.setFileToInfo(results.infos);

    console.log("There are",getAllFilePathes().length, "files");

    console.log("----------scan cache------------");
    const cache_results = fileiterator([cachePath], { 
        filter: isImage, 
        doLog: true
    });

    (cache_results.pathes||[]).forEach(p => {
        const fp =  getDirName(p);
        cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
        cacheDb.folderToFiles[fp].push(path.basename(p));
    });

    cacheDb.cacheFileToInfo = cache_results.infos;

    const {watcher, cacheWatcher} = setUpFileWatch();
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

function shouldWatch(p){
    const ext = path.extname(p).toLowerCase();
    if (!ext ||  isDisplayableInExplorer(ext) || isMusic(ext) ||isImage(ext)) {
        return true;
    }
    return false;
}

function shouldIgnore(p){
    return !shouldWatch(p);
}

function getDirName(p){
    const result =  path.dirname(p);
    return path.basename(result);
}

//!! same as file-iterator getStat()
function addStatToDb(path, stat){
    const result = {};
    result.isFile = stat.isFile();
    result.isDir = stat.isDirectory();
    result.mtimeMs = stat.mtimeMs;
    result.mtime = stat.mtime;
    result.size = stat.size;
    db.getFileToInfo()[path] = result;
}

function setUpFileWatch(){
    const watcher = chokidar.watch(home_pathes, {
        ignored: shouldIgnore,
        ignoreInitial: true,
        persistent: true,
        ignorePermissionErrors: true
    });

    const addCallBack = (path, stats) => {
        updateTagHash(path);
        db.hashTable[stringHash(path)] = path;
        addStatToDb(path, stats);
        extractThumbnailFromZip(path);
    };

    const deleteCallBack = path => {
        delete db.getFileToInfo()[path];
    };

    watcher
        .on('add', addCallBack)
        .on('unlink', deleteCallBack);
    
    // More possible events.
    watcher
        .on('addDir', addCallBack)
        .on('unlinkDir', deleteCallBack);

    //also for cache files
    const cacheWatcher = chokidar.watch(cache_folder_name, {
        ignored: shouldIgnore,
        persistent: true,
        ignorePermissionErrors: true,
        ignoreInitial: true,
    });

    cacheWatcher
        .on('unlinkDir', p => {
            const fp =  path.dirname(p);
            cacheDb.folderToFiles[fp] = undefined;
        });

    cacheWatcher
        .on('add', (p, stats) => {
            const fp =  getDirName(p);
            cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
            cacheDb.folderToFiles[fp].push(path.basename(p));

            stats.isFile = stats.isFile();
            stats.isDir = stats.isDirectory();
            cacheDb.cacheFileToInfo[p] = stats;
        })
        .on('unlink', p => {
            const fp =  getDirName(p);
            cacheDb.folderToFiles[fp] = cacheDb.folderToFiles[fp] || [];
            const index = cacheDb.folderToFiles[fp].indexOf(path.basename(p));
            cacheDb.folderToFiles[fp].splice(index, 1);

            delete cacheDb.cacheFileToInfo[p];
        });

    return {
        watcher,
        cacheWatcher
    };
}

//-------------------------Get info ----------------------
app.get('/api/cacheInfo', (req, res) => {
    const cacheFiles =  _.keys(cacheDb.cacheFileToInfo).filter(isDisplayableInOnebook);
    let totalSize = 0;

    const thumbnailNum = cacheFiles.filter(util.isCompressedThumbnail).length;

    cacheFiles.forEach(e => {
        totalSize += cacheDb.cacheFileToInfo[e].size;
    })

    res.send({
        totalSize: totalSize,
        thumbnailNum,
        cacheNum: cacheFiles.length
    })
});

app.post('/api/allInfo', (req, res) => {
    const needThumbnail = req.body && req.body.needThumbnail;

    let allThumbnails = {};
    if(needThumbnail){
        allThumbnails = getThumbnails(getAllFilePathes());
    }

    res.send({
        fileToInfo: fileToInfo,
        allThumbnails: allThumbnails
    }); 
});

function getGoodAndOtherSet(){
    const set = {};
    const otherSet = {};
    getAllFilePathes().forEach(p => {
        const ext = path.extname(p).toLowerCase();
        if(isCompress(ext)){
            const temp = parse(p);
            const name = temp && temp.author;
            if(name){
                if(p && p.startsWith(userConfig.good_folder_root)){
                    set[name] = set[name]? set[name]+1: 1;
                }else{
                    otherSet[name] = otherSet[name]? otherSet[name]+1: 1;
                }
            }
        }
    });

    return {
        set,
        otherSet
    }
}

app.get('/api/getGoodAuthorNames',async (req, res) => {
    const result = getGoodAndOtherSet();

    res.send({
        goodAuthors: result.set,
        otherAuthors: result.otherSet
    });
});

/*
*  deprecated we move the logic to frontend
*/
app.get('/api/tag', (req, res) => {
    function addOne(table, key) {
        if(!key){
            return;
        }
        if (!table[key]) {
            table[key] = 1;
        } else {
            table[key] = table[key] + 1;
        }
    }

    const tags = {};
    const authors = {};
    getAllFilePathes().forEach((e) => {
        e = path.basename(e);
        const result = parse(e);
        if (result) {
            addOne(authors, result.author);
            result.tags.forEach(tag => addOne(tags, tag));
        }

        updateTagHash(e);
    });
    res.send({ tags, authors });
});

//----------------get folder contents
app.post('/api/homePagePath', function (req, res) {
    let homepathes = path_will_scan;
    //check if pathes really exist
    const allfp = getAllFilePathes();
    homepathes = homepathes.filter(e => {
       //there is file in the folder
       return allfp.some(fp => (fp.length > e.length && fp.includes(e)));
    });

    if(homepathes.length === 0){
        console.error("Please check userConfig.js home_pathes");
        res.sendStatus(404);
    }else{
        res.send({
            dirs: homepathes
        })
    }
});

function getPageNum(contentInfo, filePath){
    if(contentInfo[filePath]){
        return +(contentInfo[filePath].pageNum) || 0;
    }else{
        return 0;
    }
}

function getMusicNum(contentInfo, filePath){
    if(contentInfo[filePath]){
        return +(contentInfo[filePath].musicNum) || 0;
    }else{
        return 0;
    }
}

function getThumbnails(filePathes){
    const thumbnails = {};
    const contentInfo = zip_content_db.getData("/");
    
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
        }else if(contentInfo[filePath]){
            const pageNum = getPageNum(contentInfo, filePath);
            if(pageNum === 0){
                thumbnails[filePath] = "NOT_THUMBNAIL_AVAILABLE";
            }
        }
    }); 
    return thumbnails;
}

function getZipInfo(filePathes){
    const fpToInfo = {};
    const contentInfo = zip_content_db.getData("/");
    
    filePathes.forEach(filePath => {
        if(isCompress(filePath) && contentInfo[filePath]){
            let pageNum = getPageNum(contentInfo, filePath);
            const musicNum = getMusicNum(contentInfo, filePath);

            const entry = {
                pageNum,
                musicNum
            }

            fpToInfo[filePath] = entry;
        }
    }); 
    return fpToInfo;
}

app.post('/api/lsDir', async (req, res) => {
    const hashdir = db.hashTable[(req.body && req.body.hash)];
    const dir = hashdir|| req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        console.error("[/api/lsDir]", dir, "does not exist");
        res.sendStatus(404);
        return;
    }

    const time1 = getCurrentTime();
    let result;
    const files = [];
    const dirs = [];
    const infos = {};
    const oneLevel = !isRecursive;
    getAllFilePathes().forEach(pp => {
        if(pp && isDisplayableInExplorer(pp) && isSub(dir, pp)){
            //add file's parent
            if(oneLevel && !isDirectParent(dir, pp)){
                let itsParent = path.resolve(pp, "..");
   
                //for example
                //the dir is     F:/git 
                //the file is    F:/git/a/b/1.zip
                //add folder           F:/git/a
                let counter = 0;
                while(!isDirectParent(dir, itsParent)){
                    itsParent = path.resolve(itsParent, "..");
                    counter++;

                    //assert
                    if(counter > 200){ throw "[lsdir] while loop" }
                }
                dirs.push(itsParent);
            }else{
                files.push(pp);
                infos[pp] = db.getFileToInfo()[pp]
            }
        }
    })

    const _dirs = util.array_unique(dirs);

    const time2 = getCurrentTime();
    const timeUsed = (time2 - time1)/1000;
    // console.log(timeUsed, "to LsDir")

    result = { dirs: _dirs, 
               files, 
               path: dir, 
               fileInfos: infos, 
               thumbnails: getThumbnails(files),
               zipInfo: getZipInfo(files)
            };
    res.send(result);
});

//---------------------------SEARCH API------------------
function isEqual(s1, s2){
    return s1 && s2 && s1.toLowerCase() === s2.toLowerCase();
}


function isSimilar(s1, s2){
    const MIN_AUTHOR_TEXT_LENGTH = 3;
    if(s1 && s2 && s2 > MIN_AUTHOR_TEXT_LENGTH){
        return s1.toLowerCase().includes(s2.toLowerCase()) && Math.abs(s1.length - s2.length) < 3;
    }

    return false;
}

function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    // let beg = (new Date).getTime()
    const files = [];
    const fileInfos = {};
    let _break;
    getAllFilePathes().forEach(path => {
        if(_break){
            return;
        }

        const info = db.getFileToInfo()[path];
        const result = (author || tag) && parse(path);
        //sometimes there are mulitple authors for one book
        if (result && author &&  
            (isEqual(result.author, author) || isEqual(result.group, author) || isSimilar(result.author, author))) {
            files.push(path);
            fileInfos[path] = info;
        } else if (result && tag && includesWithoutCase(result.tags, tag)) {
            files.push(path);
            fileInfos[path] = info;
        }else if (text && path.toLowerCase().indexOf(text.toLowerCase()) > -1) {
            files.push(path);
            fileInfos[path] = info;
        }

        if (onlyNeedFew && files.length > 5) {
            _break = true;
        }
    });
   
    // let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");
    return { files, tag, author, fileInfos, thumbnails: getThumbnails(files), zipInfo: getZipInfo(files) };
}

// three para 1.hash 2.mode 3.text
app.post(Constant.SEARCH_API, (req, res) => {
    const mode = req.body && req.body.mode;
    const textParam = req.body && req.body.text;
    const hashTag =  db.hashTable[(req.body && req.body.hash)] || textParam;
    const { MODE_TAG,
            MODE_AUTHOR,
            MODE_SEARCH
            } = Constant;

    const tag =  mode === MODE_TAG && hashTag;
    const author =  mode === MODE_AUTHOR && hashTag;
    const text = mode === MODE_SEARCH && textParam;

    if (!author && !tag && !text) {
        res.sendStatus(404);
    }else{
        res.send(searchByTagAndAuthor(tag, author, text));
    }
});

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

function read7zOutput(data) {
    const lines = data && data.split("\n");
    const files = [];
    for (let ii = 0; ii < lines.length; ii++) {
        let line = lines[ii].trim();
        let tokens = line.split(" = ");
        // an example 
        // Path = 041.jpg
        // Folder = -
        // Size = 1917111
        // Packed Size = 1865172
        // Modified = 2020-04-03 17:29:52
        // Created = 2020-04-03 17:29:52
        // Accessed = 2020-04-03 17:29:52
        if(tokens.length === 2){
            const key = tokens[0];
            const value = tokens[1].trim();
            if(key.toLowerCase() === "path"){
                files.push(value);
            }
        }
    }
    return files;
}

function get7zipOption(filePath, outputPath, file_specifier){
    //https://sevenzip.osdn.jp/chm/cmdline/commands/extract.htm
    //e make folder as one level
    if(file_specifier){
        let specifier =  _.isArray(file_specifier)? file_specifier : [file_specifier];
        specifier = specifier.map(e => {
            //-0018.jpg will break 7zip
            if(e.startsWith("-")){
                return "*" + e.slice(1);
            }else{
                return e;
            }
        })

        return ['e', filePath, `-o${outputPath}`].concat(specifier, "-aos");
    }else{
        return ['e', filePath, `-o${outputPath}`, "-aos"];
    }
}

async function listZipContent(filePath){
    try{
        //https://superuser.com/questions/1020232/list-zip-files-contents-using-7zip-command-line-with-non-verbose-machine-friend
        let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-r', '-ba' ,'-slt', filePath]));
        const text = stdout;
        if (!text || stderr) {
            return [];
        }

        const files = read7zOutput(text);
        const imgFiles = files.filter(isImage);
        const musicFiles = files.filter(isMusic)

        updateZipDb(filePath, imgFiles.length, musicFiles.length);
        return files;
    }catch(e){
        logger.error("[listZipContent]", filePath, e);
        console.error("[listZipContent]", filePath, e);
        return [];
    }
}

function updateZipDb(filePath, pageNum, musicNum){
    const contentInfo = zip_content_db.getData("/");
    contentInfo[filePath] = {
        pageNum: pageNum,
        musicNum: musicNum
    };
    zip_content_db.push("/", contentInfo);
}

const pLimit = require('p-limit');
const limit = pLimit(1);
const extractlimit = pLimit(1);
//the only required parameter is filePath
async function extractThumbnailFromZip(filePath, res, mode, counter) {
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
            counter.total--;
        }
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
            temp = turnPathSepToWebSep(temp);
            sendImage(temp);

            if(isPregenerateMode){
                counter.total--;
                console.log("[extractThumbnailFromZip] already exist", filePath);
            }
        }
        return;
    }

    try{
        if(!files){
            files = await listZipContent(filePath);
        } 
        const one = serverUtil.chooseThumbnailImage(files);
        if(!one){
            // console.error("[extractThumbnailFromZip] no thumbnail for ", filePath);
            handleFail();
            return;
        }

        const opt = get7zipOption(filePath, outputPath, one);
        const {stderrForThumbnail} = await extractlimit(() => execa(sevenZip, opt));
        if (!stderrForThumbnail) {
            // send path to client
            let temp = path.join(outputPath, path.basename(one));
            temp = turnPathSepToWebSep(temp);
            sendImage(temp);

            function logForPre(prefix, counter, total, printSpeed){
                console.log(`${prefix} ${counter}/${total}`,  filePath);
                const time2 = getCurrentTime();
                const timeUsed = (time2 - pregenBeginTime)/1000;
                printSpeed && console.log(`${prefix} ${(timeUsed /counter).toFixed(2)} seconds per file`)
            }

            const minifyImageFile = require("../tools/minifyImageFile").minifyImageFile;
            minifyImageFile(outputPath, path.basename(one), (err, info) => { 
                if(isPregenerateMode){
                    counter.minCounter++;
                    logForPre("[pre-generate minify] ", counter.minCounter, counter.total, true);
                }
             });

            if(isPregenerateMode){
                counter.counter++;
                // logForPre("[pre-generate extract]", counter.counter, counter.total);
            }
        } else {
            console.error("[extractThumbnailFromZip extract exec failed]", code);
            handleFail();
        }
    } catch(e) {
        console.error("[extractThumbnailFromZip] exception", filePath,  e);
        logger.error("[extractThumbnailFromZip] exception", filePath,  e);
        handleFail();
    }
}

let pregenBeginTime;

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
        totalFiles = allfiles.filter(e => e.includes(path));
    }

    pregenBeginTime = getCurrentTime();

    let counter = {counter: 1, total: totalFiles.length, minCounter: 1};
    totalFiles.forEach(filePath =>{
        extractThumbnailFromZip(filePath, res, "pre-generate", counter);
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

async function extractAll(filePath, outputPath, files, sendBack, res, stat){
    const opt = get7zipOption(filePath, outputPath, files);
    const { stderr } = await execa(sevenZip, opt);
    if (!stderr) {
        sendBack && fs.readdir(outputPath, (error, pathes) => {
            const temp = generateContentUrl(pathes, outputPath);
            sendBack(temp.files, temp.musicFiles, filePath, stat);
        });
    } else {
        res && res.sendStatus(500);
        console.error('[extractAll] exit: ', stderr);
    }
}

async function extractByRange(filePath, outputPath, range){
    try{
        //let quitely unzip second part
        //todo: need to cut into parts
        //when range is too large, will cause error
        const opt = get7zipOption(filePath, outputPath, range);
        const { stderr } = await execa(sevenZip, opt);
        if(stderr){
            console.error('[extractByRange] second range exit: ', stderr);  
            logger.error('[extractByRange] second range exit: ', e);
        }
    }catch (e){
        console.error('[extractByRange] second range exit: ', e);
        logger.error('[extractByRange] second range exit: ', e);
    }
}


app.post('/api/extract', async (req, res) => {
    const hashFile = db.hashTable[(req.body && req.body.hash)];
    let filePath = hashFile ||  req.body && req.body.filePath;
    const startIndex = (req.body && req.body.startIndex) || 0;
    if (!filePath) {
        res.sendStatus(404);
        return;
    }

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

    const contentInfo = zip_content_db.getData("/");
    if(contentInfo[filePath] && temp ){
        const pageNum = getPageNum(contentInfo, filePath); 
        const musicNum = getMusicNum(contentInfo, filePath);
        const totalNum = pageNum + musicNum;
        const _files = (temp.files||[]).filter(e => {
            return !util.isCompressedThumbnail(e);
        });

        if (totalNum > 0 &&  _files.length >= totalNum) {
            sendBack(temp.files, temp.musicFiles, filePath, stat);
            return;
        }else if(totalNum === 0){
            sendBack([], [], filePath, stat );
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
                extractAll(filePath, outputPath, files, sendBack, res, stat);
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

                const opt = get7zipOption(filePath, outputPath, firstRange);
                const { stderr } = await execa(sevenZip, opt);

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

//-----------------------------cache---------------------

function doCacheClean(config){
    const cleanCache = require("../tools/cleanCache");
    try{
        cleanCache.cleanCache(cachePath, config);
    }catch(e){
        console.error(e);
    }
}

app.post('/api/cleanCache', (req, res) => {
    const minized = req.body && req.body.minized;

    const allowFileNames =  getAllFilePathes().map(filePath => {
        let outputPath = getCacheOutputPath(cachePath, filePath);
        outputPath = path.basename(outputPath);
        return outputPath;
    })

    function afterClean() {
        res.sendStatus(200);
    }

    doCacheClean({minized: minized, allowFileNames: allowFileNames, afterClean: afterClean});
});

//---------------------------

const moveOrDelete = require("./routes/moveOrDelete");
app.use(moveOrDelete);

const shutdown = require("./routes/shutdown");
app.use(shutdown);

const download = require("./routes/download");
app.use(download);

const hentaiApi = require("./routes/hentaiApi");
app.use(hentaiApi);

const singleFileInfo = require("./routes/singleFileInfo");
app.use(singleFileInfo);

init();
