const express = require('express');
const fs = require('fs');
const path = require('path');
const stringHash = require("string-hash");
const chokidar = require('chokidar');
const execa = require('execa');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const winston = require("winston");
const fileChangeHandler = require("./fileChangeHandler");

const Constant = require("../constant");
const fileiterator = require('./file-iterator');
const nameParser = require('../name-parser');
const userConfig = require('../user-config');
const util = require("../util");
const pathUtil = require("./pathUtil");
const serverUtil = require("./serverUtil");

const {
        fullPathToUrl,
        getOutputPath,
        turnPathSepToWebSep,
        generateContentUrl,
        isExist,
        isDirectParent,
        isSub
} = pathUtil;
const { isImage, isCompress, isMusic, isVideo, arraySlice } = util;

const rootPath = pathUtil.getRootPath();
const cache_folder_name = userConfig.cache_folder_name;
const cachePath = path.join(rootPath, cache_folder_name);
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd-hh-mm"))+ ".log";

const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
let zip_content_db_path =  path.join(rootPath,  userConfig.workspace_name, "zip_info");
const zip_content_db = new JsonDB(new Config(zip_content_db_path, true, true, '/'));

// console.log("process.argv", process.argv);
const isProduction = process.argv.includes("--production");

console.log("--------------------");
console.log("process.cwd()", process.cwd());
console.log("__filename", __filename);
console.log("__dirname", __dirname);
console.log("rootPath", rootPath);
console.log("log path:", logPath);

const isWin = process.platform === "win32";
let sevenZip;
if(isWin){
    const sevenZipPath = path.join(process.cwd(), "resource/7zip");
    sevenZip = require(sevenZipPath)['7z'];
    console.log("sevenZipPath", sevenZipPath);
}else{
    //assume linux/mac people already install it by cmd
    //https://superuser.com/questions/548349/how-can-i-install-7zip-so-i-can-run-it-from-terminal-on-os-x
    sevenZip = "7z";
}

console.log("----------------------");


const logger = winston.createLogger({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ 
        filename: logPath, 
        formatter: function(params) {
            return params.message ? params.message : "";
        }})
    ]
  });


function isSupportedFile(e){
    return isCompress(e) || isVideo(e);
}

function updateTagHash(str){
    const result = nameParser.parse(str);
    if(result){
        result.tags.forEach(tag => {
            db.hashTable[stringHash(tag)] = tag;
        });

        if(result.author){
            db.hashTable[stringHash(result.author)] = result.author;
        }
    }
}

const app = express();
const db = {
    //a list of all files
    allFiles : [],
    //file path to file stats
    fileToInfo: {},
    //a list of cache files folder -> files
    cacheTable: {},
    //hash to any string
    hashTable: {},
};

app.use(express.static('dist', {
    maxAge: (1000*3600).toString()
}));
app.use(express.static(rootPath, {
    maxAge: (1000*3600*24).toString() // uses milliseconds per docs
}));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

fileChangeHandler.init(app, logger);

//  outputPath is the folder name
function getCache(outputPath) {
    //in-memory is fast
    const single_cache_folder = path.basename(outputPath);
    if(db.cacheTable[single_cache_folder] && db.cacheTable[single_cache_folder].length > 0){
        return generateContentUrl(db.cacheTable[single_cache_folder], outputPath);
    }
    return null;
}

async function init() {
    if(isWin){
        const {stdout, stderr} = await execa("chcp");
        console.log("[chcp]", stdout);
        const r = new RegExp("\\d+");
        const m = r.exec(stdout);
        const charset = parseInt(m && m[0]);
    
        if (charset !== 65001) {
            console.error("Please switch you console encoding to utf8 in windows language setting");
        }
    }

    console.log("scanning local files");

    const filter = (e) => {return isSupportedFile(e);};
    let beg = (new Date).getTime()
    const results = fileiterator(userConfig.path_will_scan, { 
        filter:filter, 
        doLog: true
    });
    results.pathes = results.pathes.concat(userConfig.home_pathes);
    let end = (new Date).getTime();
    console.log(`${(end - beg)/1000}s  to read local dirs`);
    console.log("Analyzing local files");
    
    const arr = [];
    for (let i = 0; i < results.pathes.length; i++) {
        const p = results.pathes[i];
        const ext = path.extname(p).toLowerCase();
        if (!ext ||  isSupportedFile(ext)) {
            arr.push(p);

            db.hashTable[stringHash(p)] = p;
            updateTagHash(p);
        }
    }
    db.allFiles = arr || [];
    db.fileToInfo = results.infos;

    console.log("There are",db.allFiles.length, "files");

    console.log("----------scan cache------------");
    const cache_results = fileiterator([cachePath], { 
        filter: isImage, 
        doLog: true
    });

    (cache_results.pathes||[]).forEach(p => {
        const fp =  getCacheFp(p);
        db.cacheTable[fp] = db.cacheTable[fp] || [];
        db.cacheTable[fp].push(path.basename(p));
    })

    setUpFileWatch();
    const port = isProduction? 3000: 8080;
    const server = app.listen(port, () => {
        console.log("----------------------------------------------------------------");
        console.log(`Listening on port ${port}`);
        console.log("init done");
        console.log("You can open ShiguReader from Browser now!");
        console.log(`http://localhost:3000`);
        console.log("----------------------------------------------------------------");
    });
}

function shouldWatch(p){
    const ext = path.extname(p).toLowerCase();
    if (!ext ||  isSupportedFile(ext) || isMusic(ext) ||isImage(ext)) {
        return true;
    }
    return false;
}

function shouldIgnore(p){
    return !shouldWatch(p);
}

function getCacheFp(p){
    const result =  path.dirname(p);
    return path.basename(result);
}

function setUpFileWatch(){
    const watcher = chokidar.watch(userConfig.home_pathes, {
        ignored: shouldIgnore,
        ignoreInitial: true,
        persistent: true,
        ignorePermissionErrors: true
    });

    const addCallBack = (path, stats) => {
        db.allFiles.push(path);

        updateTagHash(path);
        db.hashTable[stringHash(path)] = path;
        stats.isFile = stats.isFile();
        stats.isDir = stats.isDirectory();

        db.fileToInfo[path] = stats;

        extractThumbnailFromZip(path);

        hentaiCache = null;
    };

    const deleteCallBack = path => {
        const index = db.allFiles.indexOf(path);
        db.allFiles[index] = "";

        hentaiCache = null;
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
            db.cacheTable[fp] = undefined;
        });



    cacheWatcher
        .on('add', p => {
            const fp =  getCacheFp(p);
            db.cacheTable[fp] = db.cacheTable[fp] || [];
            db.cacheTable[fp].push(path.basename(p));
        })
        .on('unlink', p => {
            const fp =  getCacheFp(p);
            db.cacheTable[fp] = db.cacheTable[fp] || [];
            const index = db.cacheTable[fp].indexOf(path.basename(p));
            db.cacheTable[fp].splice(index, 1);
        });
}

let hentaiCache;
// http://localhost:8080/api/exhentaiApi
app.get('/api/exhentaiApi', function (req, res) {
    if(hentaiCache){
        res.send(hentaiCache); 
        return;
    }

    let allfiles = db.allFiles.filter(isCompress);
    allfiles = allfiles.map(e => {
        return path.basename(e, path.extname(e)).trim();
    });

    hentaiCache = {
        allFiles: allfiles
    }
    res.send(hentaiCache); 
})

//-------------------------Get info ----------------------
app.get('/api/allInfo', (req, res) => {
    const tempfileToInfo = {};
    const allFiles = [];
    // let beg = (new Date).getTime()
    db.allFiles.forEach(e => {
        if(util.isCompress(e)){
            tempfileToInfo[e] = {
                size: db.fileToInfo[e].size,
                mtime:  db.fileToInfo[e].mtime
            };
            allFiles.push(e);
        }
    })

    const allThumbnails = getThumbnails(allFiles);

    // let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");

    res.send({
        fileToInfo: tempfileToInfo,
        allFiles,
        allThumbnails
    }); 
});

function getGoodAndOtherSet(){
    const set = {};
    const otherSet = {};
    db.allFiles.forEach(p => {
        const ext = path.extname(p).toLowerCase();
        if(isCompress(ext)){
            const temp = nameParser.parse(p);
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
    db.allFiles.forEach((e) => {
        e = path.basename(e);
        const result = nameParser.parse(e);
        if (result) {
            addOne(authors, result.author);
            result.tags.forEach(tag => addOne(tags, tag));
        }

        updateTagHash(e);
    });
    res.send({ tags, authors });
});

//----------------for video streaming
app.get('/api/video/:hash', async (req, res) => {
    const filepath = db.hashTable[req.params.hash];
    const stat = await pfs.stat(filepath);
    const fileSize = stat.size;
    const range = req.headers.range;
  
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1]? parseInt(parts[1], 10) : fileSize-1;
  
      if(start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n'+start+' >= '+fileSize);
        return;
      }
      
      const chunksize = (end-start) + 1;
      const file = fs.createReadStream(filepath, {start, end});
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
  
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(filepath).pipe(res)
    }
  })

//----------------get folder contents
function getThumbnails(filePathes){
    const thumbnails = {};
    const contentInfo = zip_content_db.getData("/");
    
    filePathes.forEach(filePath => {
        if(!isCompress(filePath)){
            return;
        }

        const outputPath = getOutputPath(cachePath, filePath);
        let cacheFiles = getCache(outputPath);
        cacheFiles = (cacheFiles && cacheFiles.files) || [];
        const thumb = serverUtil.chooseThumbnailImage(cacheFiles);
        if(thumb){
            thumbnails[filePath] = fullPathToUrl(thumb);
        }else{
            const pageNum = contentInfo[filePath] && contentInfo[filePath].pageNum;
            if(pageNum === "NOT_THUMBNAIL_AVAILABLE" || pageNum === 0){
                thumbnails[filePath] = "NOT_THUMBNAIL_AVAILABLE";
            }
        }
    }); 
    return thumbnails;
}

app.post('/api/lsDir', async (req, res) => {
    const hashdir = db.hashTable[(req.body && req.body.hash)];
    const dir = hashdir|| req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        console.error(dir, "does not exist");
        res.sendStatus(404);
        return;
    }

    const time1 = getCurrentTime();
    let result;
    const files = [];
    const dirs = [];
    const infos = {};
    const oneLevel = !isRecursive;
    db.allFiles.forEach(pp => {
        if(pp && isSub(dir, pp)){
            const singleInfo = db.fileToInfo[pp];
            if(oneLevel && !isDirectParent(dir, pp)){
                let itsParent = path.resolve(pp, "..");
   
                //for example
                //the dir is     F:/git 
                //the file is    F:/git/a/b/1.zip
                //add            F:/git/a
                let counter = 0;
                while(!isDirectParent(dir, itsParent)){
                    itsParent = path.resolve(itsParent, "..");
                    counter++;

                    if(counter > 200){
                        throw "[lsdir] while loop"
                    }
                }
                dirs.push(itsParent);
                return;
            }

            const ext = path.extname(pp).toLowerCase();
            if (isSupportedFile(ext)){
                files.push(pp);
                infos[pp] = singleInfo;
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
               thumbnails: getThumbnails(files)};
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
    for (let ii = 0; ii < db.allFiles.length; ii++) {
        const path = db.allFiles[ii];
        const info = db.fileToInfo[path];
        const result = (author || tag) && nameParser.parse(path);
        //sometimes there are mulitple authors for one book
        if (result && author &&  
            (isEqual(result.author, author) || isEqual(result.group, author) || isSimilar(result.author, author))) {
            files.push(path);
            fileInfos[path] = info;
        } else if (result && tag && result.tags.indexOf(tag) > -1) {
            files.push(path);
            fileInfos[path] = info;
        }else if (text && path.toLowerCase().indexOf(text.toLowerCase()) > -1) {
            files.push(path);
            fileInfos[path] = info;
        }

        if (onlyNeedFew && files.length > 5) {
            break;
        }
    }

    // let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");
    return { files, tag, author, fileInfos, thumbnails: getThumbnails(files) };
}

// three para 1.hash 2.mode 3.text
app.post(Constant.SEARCH_API, (req, res) => {
    const mode = req.body && req.body.mode;
    const hashTag =  db.hashTable[(req.body && req.body.hash)];
    const { MODE_TAG,
            MODE_AUTHOR,
            MODE_SEARCH
            } = Constant;


    const tag =  mode === MODE_TAG && hashTag;
    const author =  mode === MODE_AUTHOR && hashTag;
    const text = mode === MODE_SEARCH && req.body && req.body.text;

    if (!author && !tag && !text) {
        res.sendStatus(404);
        return;
    }

    res.send(searchByTagAndAuthor(tag, author, text));
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
    chosendFileName = serverUtil.chooseOneZipForOneTag(files);
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
        return ['e', filePath, `-o${outputPath}`].concat(file_specifier, "-aos");
    }else{
        return ['e', filePath, `-o${outputPath}`, "-aos"];
    }
}

async function listZipContent(filePath){
    //https://superuser.com/questions/1020232/list-zip-files-contents-using-7zip-command-line-with-non-verbose-machine-friend
    let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-r', '-ba' ,'-slt', filePath]));
    const text = stdout;
    if (!text) {
        return [];
    }

    const files = read7zOutput(text);
    return files;
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

    const outputPath = getOutputPath(cachePath, filePath);
 
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

    //only update zip db
    //do not use zip db's information
    //in case previous info is changed or wrong
    function updateZipDb(pageNum){
        const contentInfo = zip_content_db.getData("/");
        contentInfo[filePath] = {
            pageNum: pageNum
        };
        zip_content_db.push("/", contentInfo);
    }

    function handleFail(){
        sendable && res.sendStatus(404);
        updateZipDb("NOT_THUMBNAIL_AVAILABLE");
        if(isPregenerateMode){
            counter.total--;
        }
    }

    //check if there is compress thumbnail  e.g thumbnail--001.jpg
    const cacheFiles = getCache(outputPath);
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
        const files = await listZipContent(filePath);
        if(files.length === 0){
            console.error("[extractThumbnailFromZip]", "no text");
            handleFail && handleFail();
        }

        const one = serverUtil.chooseThumbnailImage(files);
        
        if (!one) {
            console.log("[extractThumbnailFromZip]", filePath,  "no image file from output");
            handleFail();
            return;
        }

        //Overwrite mode: -aos	Skip extracting of existing files.
        const opt = get7zipOption(filePath, outputPath, one);
        const {stderrForThumbnail} = await extractlimit(() => execa(sevenZip, opt));
        if (!stderrForThumbnail) {
            // send path to client
            let temp = path.join(outputPath, path.basename(one));
            temp = turnPathSepToWebSep(temp);
            sendImage(temp);
            updateZipDb(files.length);

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
                logForPre("[pre-generate extract]", counter.counter, counter.total);
            }
        } else {
            console.error("[extractThumbnailFromZip extract exec failed]", code);
            handleFail();
        }
    } catch(e) {
        console.error("[extractThumbnailFromZip] exception", e);
        logger.error("[extractThumbnailFromZip] exception", e);
        handleFail();
    }
}

function getCurrentTime(){
    return new Date().getTime();
}

let pregenBeginTime;

//  a huge back ground task 
//  it generate all thumbnail and will be slow
app.post('/api/pregenerateThumbnails', (req, res) => {
    let path = req.body && req.body.path;
    if(!path){
        return;
    }

    let totalFiles = db.allFiles.filter(isCompress);
    if(path !== "All_Pathes"){
        totalFiles = db.allFiles.filter(e => e.includes(path));
    }

    pregenBeginTime = getCurrentTime();

    // const totalFiles = !path ? db.allFiles : db.allFiles.filter(e => e.includes(path));
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

async function extractAll(filePath, outputPath, sendBack, res, stat){
    const opt = get7zipOption(filePath, outputPath);
    const { stderr } = await execa(sevenZip, opt);
    if (!stderr) {
        sendBack && fs.readdir(outputPath, (error, pathes) => {
            const temp = generateContentUrl(pathes, outputPath);
            sendBack(temp.files, temp.dirs, temp.musicFiles, filePath, stat);
        });
    } else {
        res && res.sendStatus(500);
        console.error('[extractAll] exit: ', stderr);
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
        const isSomewhere = db.allFiles.some(e => {
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

    function sendBack(files, dirs, musicFiles, path, stat){
        const tempFiles =  serverUtil.filterHiddenFile(files);
        res.send({ files: tempFiles, dirs, musicFiles,path, stat });
    }

    const outputPath = getOutputPath(cachePath, filePath);
    const temp = getCache(outputPath);
    //TODO: should use pageNum
    const total_page_num = 15;
    if (temp && temp.files.length > total_page_num) {
        sendBack(temp.files, temp.dirs, temp.musicFiles, filePath, stat);
        return;
    }

    (async () => {
        const full_extract_max = 10;
        try{
            const files = await listZipContent(filePath);
            if(files.length === 0){
               res.sendStatus(500);
               console.error(`[/api/extract] ${filePath} has no content`);
            }

            let hasNoImage = files.some(e => !isImage(e));
            if(hasNoImage || files.length <= full_extract_max){
                extractAll(filePath, outputPath, sendBack, res, stat);
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
                    debugger
                    throw "arraySlice wrong";
                }

                const opt = get7zipOption(filePath, outputPath, firstRange);
                const { stderr } = await execa(sevenZip, opt);

                if (!stderr) {
                    const temp = generateContentUrl(files, outputPath);
                    sendBack(temp.files, temp.dirs, temp.musicFiles, filePath, stat);
                    const time2 = getCurrentTime();
                    const timeUsed = (time2 - time1);
                    console.log(`[/api/extract] FIRST PART UNZIP ${filePath} : ${timeUsed}ms`);

                    //let quitely unzip second part
                    const opt = get7zipOption(filePath, outputPath, secondRange);
                    const { stderr2 } = await execa(sevenZip, opt);
                    if(stderr2){
                        console.error('[/api/extract] second range exit: ', stderr2);  
                    }else{
                        const time3 = getCurrentTime();
                        const timeUsed = (time3 - time2);
                        console.log(`[/api/extract] Second PART UNZIP ${filePath} : ${timeUsed}ms`);
                    }
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

app.get('/api/cleanCache', (req, res) => {
    const minized = req.body && req.body.minized;

    const allowFileNames =  db.allFiles.map(filePath => {
        let outputPath = getOutputPath(cachePath, filePath);
        outputPath = path.basename(outputPath);
        return outputPath;
    })

    doCacheClean({minized: minized, allowFileNames: allowFileNames});
});

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
