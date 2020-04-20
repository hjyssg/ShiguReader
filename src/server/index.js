const express = require('express');
const fs = require('fs');
const path = require('path');
const stringHash = require("string-hash");
const chokidar = require('chokidar');
const execa = require('execa');
const pfs = require('promise-fs');
const dateFormat = require('dateformat');
const winston = require("winston");
var cors = require('cors')
const fileChangeHandler = require("./fileChangeHandler");

const Constant = require("../constant");
const fileiterator = require('./file-iterator');
const nameParser = require('../name-parser');
const userConfig = require('../user-config');
const util = require("../util");
const pathUtil = require("./pathUtil");
const {
        fullPathToUrl,
        getOutputPath,
        turnPathSepToWebSep,
        generateContentUrl,
        isExist,
        isDirectParent,
        isSubDirectory
} = pathUtil;
const { isImage, isCompress, isMusic, isVideo } = util;

const rootPath = pathUtil.getRootPath();
const cache_folder_name = userConfig.cache_folder_name;
const cachePath = path.join(rootPath, cache_folder_name);
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "isoDate"))+ ".log";
let file_db_path =  path.join(rootPath,  userConfig.workspace_name, "shigureader_local_file_info");


const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
let zip_content_db_path =  path.join(rootPath,  userConfig.workspace_name, "shigureader_zip_file_content_info");

const zip_content_db = new JsonDB(new Config(zip_content_db_path, true, true, '/'));

// console.log("process.argv", process.argv);
const isProduction = process.argv.includes("--production");

console.log("--------------------");
console.log("process.cwd()", process.cwd());
console.log("__filename", __filename);
console.log("__dirname", __dirname);
console.log("rootPath", rootPath);
console.log("log path:", logPath);
console.log("file_db_path", file_db_path);

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

const pLimit = require('p-limit');
const limit = pLimit(6);

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
        doLog: true,
        db_path: file_db_path
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

function setUpFileWatch(){
    const watcher = chokidar.watch(userConfig.home_pathes, {
        ignored: /\*.jpg/,
        ignoreInitial: true,
        persistent: true,
        ignorePermissionErrors: true
    });

    const addCallBack = (path, stats) => {
        db.allFiles.push(path);

        updateTagHash(path);
        db.hashTable[stringHash(path)] = path;
        stats.isFile = stats.isFile();
        stats.isDirectory = stats.isDirectory();

        db.fileToInfo[path] = stats;
    };

    const deleteCallBack = path => {
        const index = db.allFiles.indexOf(path);
        db.allFiles[index] = "";
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
        persistent: true,
        ignorePermissionErrors: true
    });

    cacheWatcher
        .on('unlinkDir', p => {
            const fp =  path.dirname(p);
            db.cacheTable[fp] = undefined;
        });

    function getCacheFp(p){
        const result =  path.dirname(p);
        return path.basename(result);
    }

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


// http://localhost:8080/api/exhentaiApi
app.post('/api/exhentaiApi/', cors(), function (req, res) {
    const src = req.body && req.body.src;
    res.send({
        allFiles: db.allFiles
    }); 
    console.log("/api/exhentaiApi/");
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

app.get('/api/getGoodAuthorNames',async (req, res) => {
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

    res.send({
        goodAuthors: set,
        otherAuthors: otherSet
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
function getThumbnails(files){
    const thumbnails = {};
    files.forEach(fileName => {
        const outputPath = getOutputPath(cachePath, fileName);
        let cacheFiles = getCache(outputPath);
        cacheFiles = (cacheFiles && cacheFiles.files) || [];
        const thumb = util.chooseThumbnailImage(cacheFiles);
        if(thumb){
            thumbnails[fileName] = fullPathToUrl(thumb);
        }
    }); 
    return thumbnails;
}

app.post('/api/lsDir', async (req, res) => {
    const hashdir = db.hashTable[(req.body && req.body.hash)];
    const dir = hashdir|| req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        res.sendStatus(404);
        return;
    }

    let result;
    const files = [];
    const dirs = [];
    const infos = {};
    const oneLevel = !isRecursive;
    db.allFiles.forEach(p => {
        if(p && isSubDirectory(dir, p)){
            const singleInfo = db.fileToInfo[p];
            if(oneLevel && !isDirectParent(dir, p)){
                let itsParent = path.resolve(p, "..");
   
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

            const ext = path.extname(p).toLowerCase();
            if (isSupportedFile(ext)){
                files.push(p);
                infos[p] = singleInfo;
            }
        }
    })

    const _dirs = util.array_unique(dirs);
    result = { dirs: _dirs, 
               files, path: 
               dir, 
               fileInfos: infos, 
               thumbnails: getThumbnails(files)};
    res.send(result);
});

//---------------------------SEARCH API------------------

function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    // let beg = (new Date).getTime()
    const MIN_AUTHOR_TEXT_LENGTH = 3;
    const files = [];
    const fileInfos = {};
    for (let ii = 0; ii < db.allFiles.length; ii++) {
        const e = db.allFiles[ii];
        const info = db.fileToInfo[e];
        const result = (author || tag) && nameParser.parse(e);
        //sometimes there are mulitple authors for one book
        if (result && author &&  (result.author === author || (author.length >= MIN_AUTHOR_TEXT_LENGTH && result.author &&  result.author.includes(author)) || result.group === author )) {
            files.push(e);
            fileInfos[e] = info;
        } else if (result && tag && result.tags.indexOf(tag) > -1) {
            files.push(e);
            fileInfos[e] = info;
        }else if (text && e.toLowerCase().indexOf(text.toLowerCase()) > -1) {
            files.push(e);
            fileInfos[e] = info;
        }

        if (onlyNeedFew && files.length > 5) {
            break;
        }
    }

    // let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");
    return { files, tag, author, fileInfos };
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
    chosendFileName = util.chooseOneZipForOneTag(files);
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
            if(key.toLowerCase() === "path" && isImage(value)){
                files.push(value);
            }
        }
    }
    return files;
}

function get7zipOption(fileName, outputPath, one){
    //https://sevenzip.osdn.jp/chm/cmdline/commands/extract.htm
    //e make folder as one level
    if(one){
        return ['e', fileName, `-o${outputPath}`, one, "-aos"];
    }else{
        return ['e', fileName, `-o${outputPath}`, "-aos"];
    }
}

async function extractThumbnailFromZip(fileName, res, mode, counter) {
    if(!util.isCompress(fileName)){
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    const sendable = !isPregenerateMode;

    const outputPath = getOutputPath(cachePath, fileName);
 
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

    function updateZipDb(pageNum){
        const contentInfo = zip_content_db.getData("/");
        contentInfo[fileName] = {
            pageNum: pageNum
        };
        zip_content_db.push("/", contentInfo);
    }

    function handleFail(){
        sendable && res.sendStatus(404);
        updateZipDb(0);
    }

    //check if there is compress thumbnail  e.g thumbnail--001.jpg
    const cacheFiles = getCache(outputPath);
    if (cacheFiles && cacheFiles.files.length > 0) {
        const tempOne =  util.chooseThumbnailImage(cacheFiles.files);
        if(util.isCompressedThumbnail(tempOne)){
            let temp = path.join(outputPath, path.basename(tempOne));
            temp = turnPathSepToWebSep(temp);
            sendImage(temp);
        }
        return;
    }

    try{
        //https://superuser.com/questions/1020232/list-zip-files-contents-using-7zip-command-line-with-non-verbose-machine-friend
        let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-r', '-ba' ,'-slt', fileName]));
        const text = stdout;
        
        if (!text) {
            console.error("[extractThumbnailFromZip]", "no text");
            handleFail();
            return;
        }

        const files = read7zOutput(text);
        const one = util.chooseThumbnailImage(files);
        
        if (!one) {
            console.log("[extractThumbnailFromZip]", fileName,  "no image file from output");
            handleFail();
            return;
        }

        //Overwrite mode: -aos	Skip extracting of existing files.
        const opt = get7zipOption(fileName, outputPath, one);
        const {stderrForThumbnail} = await execa(sevenZip, opt);
        if (!stderrForThumbnail) {
            // send path to client
            let temp = path.join(outputPath, path.basename(one));
            temp = turnPathSepToWebSep(temp);
            sendImage(temp);
            updateZipDb(files.length);

            const minifyImageFile = require("../tools/minifyImageFile").minifyImageFile;
            minifyImageFile(outputPath, path.basename(one), (err, info) => { 
                if(isPregenerateMode){
                    counter.minCounter++;
                    console.log("[extractThumbnailFromZip] get minized thumbnail", counter.minCounter);
                }
             });

            if(isPregenerateMode){
                counter.counter++;
                console.log("[extractThumbnailFromZip] pre-generate", counter.counter, "/", counter.total);
            }
        } else {
            console.error("[extractThumbnailFromZip extract exec failed]", code);
            handleFail();
        }
    } catch(e) {
        console.error("[extractThumbnailFromZip] exception", e);
        handleFail();
    }
}

//  a huge back ground task 
//  it generate all thumbnail and will be slow
app.post('/api/pregenerateThumbnails', (req, res) => {
    let path = req.body && req.body.path;
    if(!path){
        return;
    }
    // const totalFiles = !path ? db.allFiles : db.allFiles.filter(e => e.includes(path));
    const totalFiles = db.allFiles.filter(e => e.includes(path));
    let counter = {counter: 1, total: totalFiles.length, minCounter: 1};
    totalFiles.forEach(fileName =>{
        extractThumbnailFromZip(fileName, res, "pre-generate", counter);
    })
});


//! !need to set windows console to utf8
app.post('/api/firstImage', async (req, res) => {
    const fileName = req.body && req.body.fileName;

    if (!fileName || !(await isExist(fileName))) {
        res.sendStatus(404);
        return;
    }
    extractThumbnailFromZip(fileName, res);
});

app.post('/api/extract', async (req, res) => {
    const hashFile = db.hashTable[(req.body && req.body.hash)];
    let fileName = hashFile ||  req.body && req.body.fileName;
    if (!fileName) {
        res.sendStatus(404);
        return;
    }

    if(!(await isExist(fileName))){
        //maybe the file move to other location
        const baseName = path.basename(fileName);
        //todo loop is slow
        const isSomewhere = db.allFiles.some(e => {
            if(e.endsWith(baseName)){
                fileName = e;
                return true;
            }
        });

        if(!isSomewhere){
            res.sendStatus(404);
            return;
        }
    }
    
    const stat = await pfs.stat(fileName);

    function sendBack(files, dirs, musicFiles, path, stat){
        const tempFiles =  util.filterHiddenFile(files);
        res.send({ files: tempFiles, dirs, musicFiles,path, stat });
    }

    const outputPath = getOutputPath(cachePath, fileName);
    const temp = getCache(outputPath);
    //TODO: should use pageNum
    if (temp && temp.files.length > 10) {
        sendBack(temp.files, temp.dirs, temp.musicFiles, fileName, stat);
        return;
    }

    (async () => {
        try{
            const opt = get7zipOption(fileName, outputPath);
            const {stdout, stderr} = await execa(sevenZip, opt);
            if (!stderr) {
                fs.readdir(outputPath, (error, results) => {
                    const temp = generateContentUrl(results, outputPath);
                    sendBack(temp.files, temp.dirs, temp.musicFiles, fileName, stat);
                });
            } else {
                res.sendStatus(500);
                console.error('[/api/extract] exit: ', stderr);
            }
        } catch (e){
            res.sendStatus(500);
            console.error('[/api/extract] exit: ', e);
        }
    })();
});

//-----------------------------cache---------------------

function doCacheClean(minized){
    const cleanCache = require("../tools/cleanCache");
    try{
        cleanCache.cleanCache(cachePath, minized);
    }catch(e){
        console.error(e);
    }
}

app.get('/api/cleanCache', (req, res) => {
    const minized = req.body && req.body.minized;
    doCacheClean(minized);
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
