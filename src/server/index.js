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

const Constant = require("../constant");
const fileiterator = require('./file-iterator');
const nameParser = require('../name-parser');
const userConfig = require('../user-config');
const util = require("../util");

const isExist = async (path) => {
    try{
        const error = await pfs.access(path);
        return !error;
    }catch(e){
        return false;
    }
};

let rootPath = path.join(__dirname, "..", "..");
const cache_folder_name = userConfig.cache_folder_name;
const cachePath = path.join(__dirname, "..", "..", cache_folder_name);
let logPath = path.join(__dirname, "..","..", userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "isoDate"))+ ".log";
let file_db_path =  path.join(__dirname, "..", "..",  userConfig.workspace_name, "shigureader_local_file_info");
const sevenZipPath = path.join(process.cwd(), "resource/7zip");


const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
let zip_content_db_path =  path.join(__dirname, "..", "..",  userConfig.workspace_name, "shigureader_zip_file_content_info");

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
console.log("sevenZipPath", sevenZipPath);
console.log("----------------------");

const isWin = process.platform === "win32";
let sevenZip;
if(isWin){
    sevenZip = require(sevenZipPath)['7z'];
}else{
    //assume linux/mac people already install it by cmd
    //https://superuser.com/questions/548349/how-can-i-install-7zip-so-i-can-run-it-from-terminal-on-os-x
    sevenZip = "7z";
}

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

const isImage = util.isImage;
const isCompress = util.isCompress;
const isMusic = util.isMusic;

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

app.use(express.static('dist'),{
    maxAge: (1000*3600*5).toString
});
app.use(express.static(rootPath, {
    maxAge: (1000*3600*24*30).toString // uses milliseconds per docs
}));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

function getOutputPath(zipFn) {
    let outputFolder;
    outputFolder = path.basename(zipFn, path.extname(zipFn));
    if(!userConfig.readable_cache_folder_name){
        outputFolder = stringHash(zipFn).toString();
    }else{
        outputFolder = outputFolder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>/]/gi, '');
    }
    return path.join(cachePath, outputFolder);
}

function cleanFileName(fn) {
    return fn.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
}

function generateContentUrl(pathes, outputPath) {
    const files = [];
    const dirs = [];
    const musicFiles = [];
    const base = path.basename(outputPath);
    for (let i = 0; i < pathes.length; i++) {
        const p = pathes[i];
        let temp = path.join(cache_folder_name, base, p);
        temp = cleanFileName(temp);
        if (isImage(p)) {
            files.push(temp);
        }else if(isMusic(p)){
            musicFiles.push(temp);
        }
    }
    return { files, dirs, musicFiles };
}

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

    console.log("clean previous cache files");
    doClean();

    console.log("scanning local files");

    const filter = (e) => {return isCompress(e);};
    let beg = (new Date).getTime()
    const results = fileiterator(userConfig.home_pathes, { 
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
        if (!ext || isCompress(ext)) {
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
    app.listen(port, () => {
        console.log("----------------------------------------------------------------");
        console.log(`Listening on port ${port}`);
        console.log("init done");
        console.log("You can open ShiguReader from Browser now!");
        console.log(`http://localhost:3000`);
        console.log("----------------------------------------------------------------");
    });
}

// async function getExtraInfo(fileName, stat){
//     if(!isCompress(fileName)　|| fileName.includes("アニメ")){
//         return;
//     }

//     let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-r', fileName]));
//     const text = stdout;
//     if (!text) {
//         return {};
//     }
    
//     const files = read7zOutput(text, Infinity);
//     console.log(fileName, files.length);
//     return {fileNum: files.length}
// }

function setUpFileWatch(){
    const watcher = chokidar.watch(userConfig.home_pathes, {
        ignored: /\*.jpg/,
        ignoreInitial: true,
        persistent: true
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
        persistent: true
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

init();

// http://localhost:8080/api/exhentaiApi
app.post('/api/exhentaiApi/', cors(), function (req, res) {
    const src = req.body && req.body.src;
    res.send({
        allFiles: db.allFiles
    }); 
    console.log("/api/exhentaiApi/");
})

app.post('/api/moveFile', (req, res) => {
    const src = req.body && req.body.src;
    const dest = req.body && req.body.dest;

    if(!src || !dest){
        res.sendStatus(404);
        return;
    }

    (async () =>{
        try{
            let err;
            if(!(await isExist(dest))){
                err = await pfs.mkdir(dest);
            }
            if (!err) {
                const {stdout, stderr} = await execa("move", [src, dest]);
                err = stderr;
                // err = await pfs.rename(src, dest);
            }

            if(!err){
                logger.info(`[MOVE] ${src} to ${dest}`);
                res.sendStatus(200);
            }else{
                console.error(err);
                res.sendStatus(404);
            }
        }catch(e){
            console.error(e);
            res.sendStatus(404);
        }
    })();
});

app.post('/api/deleteFile', (req, res) => {
    const src = req.body && req.body.src;

    if(!src){
        res.sendStatus(404);
        return;
    }

    fs.unlink(src, (err) => {
        if (err){
            console.error(err);
            res.sendStatus(404);
        }else{
            res.sendStatus(200);
            logger.info(`[DELETE] ${src}`);
        }
    });
});

app.post('/api/allInfo', (req, res) => {
    const tempfileToInfo = {};
    db.allFiles.forEach(e => {
        if(util.isCompress(e)){
            tempfileToInfo[e] = {
                size: db.fileToInfo[e].size,
                mtime:  db.fileToInfo[e].mtime
            };
        }
    })

    res.send({
        fileToInfo: tempfileToInfo
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
})

app.post('/api/lsDir', async (req, res) => {
    const hashdir = db.hashTable[(req.body && req.body.hash)];
    const dir = hashdir|| req.body && req.body.dir;
    const isRecursive = req.body && req.body.isRecursive;

    if (!dir || !(await isExist(dir))) {
        res.sendStatus(404);
        return;
    }

    function getThumbnails(files){
        const contentInfo = zip_content_db.getData("/");
        const thumbnails = {};
        files.forEach(fileName => {
            if(contentInfo[fileName] && contentInfo[fileName].thumbnail) {
                thumbnails[fileName] = fullPathToUrl(contentInfo[fileName].thumbnail);
            }
        }); 
        return thumbnails;
    }
    
    let result;
    if(isRecursive){
        const files = [];
        const dirs = [];
        const infos = {};
        db.allFiles.forEach(p => {
            if(p && p.startsWith(dir)){
                const ext = path.extname(p).toLowerCase();
                if (isImage(ext) || isCompress(ext) || util.isVideo(ext)){
                    files.push(p);
                    infos[p] = db.fileToInfo[p];
                }
            }
        })

        result = {dirs, files, path: dir, fileInfos: infos, thumbnails: getThumbnails(files)};
        res.send(result);
    }else{
        fs.readdir(dir, (error, results) => {
            const files = [];
            const dirs = [];
            const infos = {};
    
            for (let i = 0; results && i < results.length; i++) {
                let p = results[i];
                const ext = path.extname(p).toLowerCase();
                p = path.join(dir, p);
                const tempInfo = db.fileToInfo[p];
    
                if (tempInfo && tempInfo.isDirectory) {
                    dirs.push(p);
                    infos[p] = tempInfo;
                } else if (isImage(ext) || isCompress(ext) || util.isVideo(ext)) {
                    files.push(p);
                    infos[p] = tempInfo;
                }
    
                updateTagHash(p);
                db.hashTable[stringHash(p)] = p;
            }
    
            result = {dirs, files, path: dir, fileInfos: infos, thumbnails: getThumbnails(files)};
            res.send(result);
        });
    }
});

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

app.get('/api/tag', (req, res) => {
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

const MIN_AUTHOR_LENGTH = 3;

function searchByTagAndAuthor(tag, author, text, onlyNeedFew) {
    // let beg = (new Date).getTime()
    const files = [];
    const fileInfos = {};
    for (let ii = 0; ii < db.allFiles.length; ii++) {
        const e = db.allFiles[ii];
        const info = db.fileToInfo[e];
        const result = (author || tag) && nameParser.parse(e);
        //sometimes there are mulitple authors for one book
        if (result && author &&  (result.author === author || (author.length >= MIN_AUTHOR_LENGTH && result.author &&  result.author.includes(author)) || result.group === author )) {
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

// tree para
// 1. hash
// 2. mode
// 3. text
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

app.post(Constant.TAG_THUMBNAIL_PATH_API, (req, res) => {
    const author = req.body && req.body.author;
    const tag = req.body && req.body.tag;
    if (!author && !tag) {
        res.sendStatus(404);
        return;
    }

    const { files } = searchByTagAndAuthor(tag, author, null, true);
    const filePathes = files;
    const fileNames = filePathes.filter(e => {
        if(e.includes("アニメ")){
            return false;
        }
        return isCompress(e);
    });
    chosendFileName = chooseOneZip(fileNames);
    if(!chosendFileName){
        res.sendStatus(404);
        return;
    }

    getFirstImageFromZip(chosendFileName, res);
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

function chooseThumbnailImage(files){
    let tempFiles = files.filter(isImage);
    tempFiles = util.filterHiddenFile(tempFiles);
    util.sortFileNames(tempFiles);
    return tempFiles[0];
}

function chooseOneZip(files){
    let tempFiles = files.filter(isCompress);
    tempFiles = util.filterHiddenFile(tempFiles);
    return tempFiles[0];
}

function fullPathToUrl(img){
    const fullpath = path.resolve(img);
    return "..\\"+ path.relative(rootPath, fullpath);
}

async function getFirstImageFromZip(fileName, res, mode, counter) {
    if(!util.isCompress(fileName)){
        return;
    }

    const isPregenerateMode = mode === "pre-generate";
    const sendable = !isPregenerateMode;

    const contentInfo = zip_content_db.getData("/");
    if(contentInfo[fileName]){
        if(contentInfo[fileName].thumbnail) {
            const img = contentInfo[fileName].thumbnail;
            if(img){
                sendImage(img);
                return;
            }
        }else if(!contentInfo[fileName].thumbnail){
            return;
        }
    }
 
    const outputPath = getOutputPath(fileName);
 
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

    const stats = await pfs.stat(fileName);
    const fileSizeInBytes = stats["size"]
    //Convert the file size to megabytes (optional)
    const fileSizeInMegabytes = fileSizeInBytes / 1000000.0;

    function updateZipDb(thumbnail, pageNum){
        // const time1 = new Date().getTime();
        contentInfo[fileName] = {
            thumbnail: thumbnail,
            pageNum: pageNum
        };
        // zip_content_db.push("/", contentInfo);
        // const time2 = new Date().getTime();
        // console.log("[jsondb push]", (time2-time1)/1000);
    }

    try{
        //bigger than 30mb
        if(fileSizeInMegabytes > userConfig.full_extract_for_thumbnail_size || isPregenerateMode){
            // assume zip
            // let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-ba', fileName]));
            //https://superuser.com/questions/1020232/list-zip-files-contents-using-7zip-command-line-with-non-verbose-machine-friend
            let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-r', '-ba' ,'-slt', fileName]));
            const text = stdout;
            

            if (!text) {
                console.error("[getFirstImageFromZip]", "no text");
                sendable && res.send("404 fail");
                updateZipDb(null, 0);
                return;
            }

            const files = read7zOutput(text);
            const one = chooseThumbnailImage(files);
            
            if (!one) {
                console.error("[getFirstImageFromZip]", fileName,  "no files from output");
                sendable && res.sendStatus(404);
                updateZipDb(null, 0);
                return;
            }

            // Overwrite mode
            //-aos	Skip extracting of existing files.
            const opt = ['x', fileName, `-o${outputPath}`, one, "-aos"];
            const {stdout2, stderr2} = await execa(sevenZip, opt);
            if (!stderr2) {
                // send path to client
                let temp = path.join(outputPath, one);
                temp = cleanFileName(temp);
                sendImage(temp);
                updateZipDb(temp, files.length);

                if(isPregenerateMode){
                    counter.counter++;
                    console.log("[getFirstImageFromZip] pre-generate", counter.counter, "/", counter.total);
                }
            } else {
                console.error("[getFirstImageFromZip extract exec failed]", code);
                sendable && res.sendStatus(404);
            }
        } else {
            (async () => {
                const all = ['e', fileName, `-o${outputPath}`, "-aos"];
                const {stdout, stderr} = await execa(sevenZip, all);
                if (!stderr) {
                    fs.readdir(outputPath, (error, results) => {
                        const temp = generateContentUrl(results, outputPath);
                        const img = chooseThumbnailImage(temp.files);
                        if (img) {
                            sendImage(img);
                        } else {
                            sendable && res.sendStatus(404);
                            console.error('[getFirstImageFromZip extract] no image output') 
                        }
                    });
                } else {
                    sendable && res.sendStatus(404);
                    console.error('[getFirstImageFromZip extract] exit: ', stderr);
                }
            })();
        }
    } catch(e) {
        console.error("[getFirstImageFromZip] exception", e);
        sendable && res.sendStatus(404);
    }
}

//  a huge back ground tast 
//  it generate all thumbnail 
//  will need about 50 GB local space
// and will be slow
// http://localhost:8080/api/pregenerateThumbnails
app.post('/api/pregenerateThumbnails', (req, res) => {
    let path = req.body && req.body.path;
    if(!path){
        return;
    }
    // const totalFiles = !path ? db.allFiles : db.allFiles.filter(e => e.includes(path));
    const totalFiles = db.allFiles.filter(e => e.includes(path));
    let counter = {counter: 1, total: totalFiles.length};
    totalFiles.forEach(fileName =>{
        getFirstImageFromZip(fileName, res, "pre-generate", counter);
    })
});

function doClean(){
    const cleanCache = require("../tools/cleanCache");
    try{
        cleanCache.cleanCache(cachePath);
    }catch(e){
        console.error(e);
    }
}

app.get('/api/cleanCache', (req, res) => {
    doClean();
});


//! !need to set windows console to utf8
app.post('/api/firstImage', async (req, res) => {
    const fileName = req.body && req.body.fileName;

    if (!fileName || !(await isExist(fileName))) {
        res.sendStatus(404);
        return;
    }
    getFirstImageFromZip(fileName, res);
});

// http://localhost:8080/api/extract
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

    const outputPath = getOutputPath(fileName);
    const temp = getCache(outputPath);
    if (temp && temp.files.length > 10) {
        sendBack(temp.files, temp.dirs, temp.musicFiles, fileName, stat);
        return;
    }

    (async () => {
        try{
            const all = ['e', fileName, `-o${outputPath}`, "-aos"];
            const {stdout, stderr} = await execa(sevenZip, all);
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

