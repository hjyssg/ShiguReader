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
const { isImage, isCompress, isMusic, isVideo, arraySlice, getCurrentTime } = util;

const rootPath = pathUtil.getRootPath();
const cache_folder_name = userConfig.cache_folder_name;
const cachePath = path.join(rootPath, cache_folder_name);
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd hh-MM"))+ ".log";

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


function isDisplayableInExplorer(e){
    return isCompress(e) || isVideo(e);
}

function isDisplayableInOnebook(e){
    return isImage(e)||isMusic(e);
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

const getCacheOutputPath = function (cachePath, zipFilePath) {
    let outputFolder;
    outputFolder = path.basename(zipFilePath, path.extname(zipFilePath));
    if(!userConfig.readable_cache_folder_name){
        outputFolder = stringHash(zipFilePath).toString();
    }else{
        outputFolder = outputFolder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>/]/gi, '');
    }
    outputFolder = outputFolder.trim();

    const stat = db.fileToInfo[zipFilePath];
    if(!stat){
        throw "no stat"+zipFilePath
    }

    const mdate = new Date(stat.mtimeMs);
    const mstr = dateFormat(mdate, "yyyy-mm-dd");
    const fstr = (stat.size/1000/1000).toFixed();
    outputFolder = outputFolder+ `${mstr} ${fstr} `;
    return path.join(cachePath, outputFolder);
}

const app = express();
const db = {
    //a list of all files
    allFiles : [],
    //file path to file stats
    fileToInfo: {},
    //cache path to file stats
    cacheToInfo: {},
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
function getCacheFiles(outputPath) {
    //in-memory is fast
    const single_cache_folder = path.basename(outputPath);
    if(db.cacheTable[single_cache_folder] && db.cacheTable[single_cache_folder].length > 0){
        return generateContentUrl(db.cacheTable[single_cache_folder], outputPath);
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
        }
    }

    console.log("scanning local files");

    const filter = (e) => {return isDisplayableInExplorer(e);};
    let beg = (new Date).getTime()
    const results = fileiterator(path_will_scan, { 
        filter:filter, 
        doLog: true
    });
    results.pathes = results.pathes.concat(home_pathes);
    let end = (new Date).getTime();
    console.log(`${(end - beg)/1000}s  to read local dirs`);
    console.log("Analyzing local files");
    
    const arr = [];
    for (let i = 0; i < results.pathes.length; i++) {
        const p = results.pathes[i];
        const ext = path.extname(p).toLowerCase();
        if (!ext ||  isDisplayableInExplorer(ext)) {
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
    });

    db.cacheToInfo = cache_results.infos;

    const {watcher, cacheWatcher} = setUpFileWatch();
    const port = isProduction? http_port: dev_express_port;
    const server = app.listen(port, async () => {
        const lanIP = await internalIp.v4();
        const mobileAddress = `http://${lanIP}:${http_port}`;
        console.log("----------------------------------------------------------------");
        console.log(dateFormat(new Date(), "yyyy-mm-dd hh:MM"));
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

function getCacheFp(p){
    const result =  path.dirname(p);
    return path.basename(result);
}

function setUpFileWatch(){
    const watcher = chokidar.watch(home_pathes, {
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
        db.fileToInfo[path] = "";
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
        .on('add', (p, stats) => {
            const fp =  getCacheFp(p);
            db.cacheTable[fp] = db.cacheTable[fp] || [];
            db.cacheTable[fp].push(path.basename(p));

            stats.isFile = stats.isFile();
            stats.isDir = stats.isDirectory();
            db.cacheToInfo[p] = stats;
        })
        .on('unlink', p => {
            const fp =  getCacheFp(p);
            db.cacheTable[fp] = db.cacheTable[fp] || [];
            const index = db.cacheTable[fp].indexOf(path.basename(p));
            db.cacheTable[fp].splice(index, 1);
            delete db.cacheToInfo[p];
        });

    return {
        watcher,
        cacheWatcher
    };
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
app.get('/api/cacheInfo', (req, res) => {
    const cacheFiles =  _.keys(db.cacheToInfo).filter(isDisplayableInOnebook);
    let totalSize = 0;

    const thumbnailNum = cacheFiles.filter(util.isCompressedThumbnail).length;

    cacheFiles.forEach(e => {
        totalSize += db.cacheToInfo[e].size;
    })

    res.send({
        totalSize: totalSize,
        thumbnailNum,
        cacheNum: cacheFiles.length
    })
});



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

//------------------download------------
app.get('/api/download/:hash', async (req, res) => {
    const filepath = db.hashTable[req.params.hash];

    if (!filepath || !(await isExist(filepath))) {
        console.error("[/api/download]", filepath, "does not exist");
        res.sendStatus(404);
        return;
    }
    res.download(filepath); // Set disposition and send it.
});

//----------------for video streaming
app.get('/api/video/:hash', async (req, res) => {
    const filepath = db.hashTable[req.params.hash];

    if (!filepath || !(await isExist(filepath))) {
        console.error("[/api/video]", filepath, "does not exist");
        res.sendStatus(404);
        return;
    }

    try{
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
    }catch(e){
        console.error("[/api/video/]", filePath, e);
        res.sendStatus(404);
    }
  })

//----------------get folder contents
app.post('/api/homePagePath', function (req, res) {
    let homepathes = path_will_scan;
    //check if pathes really exist
    homepathes = homepathes.filter(e => {
       //there is file in the folder
       return db.allFiles.some(fp => (fp.length > e.length && fp.includes(e)));
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
        }else{
            const pageNum = contentInfo[filePath] && contentInfo[filePath].pageNum;
            if(pageNum === "NOT_THUMBNAIL_AVAILABLE" || pageNum === 0){
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
            let pageNum = contentInfo[filePath].pageNum;
            pageNum = pageNum === "NOT_THUMBNAIL_AVAILABLE"? 0 : pageNum;

            const entry = {
                pageNum,
                musicNum: contentInfo[filePath].musicNum || 0
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
            if (isDisplayableInExplorer(ext)){
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
        logger.error("[listZipContent]", filePath);
        console.error("[listZipContent]", filePath);
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
            console.error("[extractThumbnailFromZip] no thumbnail for ", filePath);
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
                logForPre("[pre-generate extract]", counter.counter, counter.total);
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

async function extractAll(filePath, outputPath, files, sendBack, res, stat){
    const opt = get7zipOption(filePath, outputPath, files);
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

    const outputPath = getCacheOutputPath(cachePath, filePath);
    const temp = getCacheFiles(outputPath);

    const contentInfo = zip_content_db.getData("/");
    let pageNum = contentInfo[filePath] && contentInfo[filePath].pageNum;
    pageNum = pageNum === "NOT_THUMBNAIL_AVAILABLE"? 0 : pageNum;
    if (pageNum > 0 &&  temp && temp.files.length >= pageNum) {
        sendBack(temp.files, temp.dirs, temp.musicFiles, filePath, stat);
        return;
    }

    (async () => {
        const full_extract_max = 10;
        try{
            let files = await listZipContent(filePath);
            files = files.filter(e => isDisplayableInOnebook(e));
            if(files.length === 0){
               res.sendStatus(500);
               console.error(`[/api/extract] ${filePath} has no content`);
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
                    sendBack(temp.files, temp.dirs, temp.musicFiles, filePath, stat);
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

    const allowFileNames =  db.allFiles.map(filePath => {
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
function shutdown (cb) {
    //modify https://github.com/hemanth/power-off/
    let cmd = '';

    if(isLinux() || isOsx()) {
        cmd = 'sudo shutdown -h now';
    } else if(isWindows()) {
        cmd = 'shutdown /s /f';
    } else {
        throw new Error('Unknown OS!');
    }

    cp.exec(cmd, function (err, stdout, stderr) {
        logger.info("[shutdown]", getCurrentTime());
        cb && cb(err, stdout, stderr);
    });
};


app.post('/api/shutdownServer', function (req, res) {
    shutdown();
    res.sendStatus(200);
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
