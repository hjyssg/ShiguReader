const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const fileiterator = require('../file-iterator');
const nameParser = require('../name-parser');
const userConfig = require('../user-config');
const sevenZip = require('7zip')['7z'];

const stringHash =require("string-hash");
var chokidar = require('chokidar');
const execa = require('execa');

const root = path.join(__dirname, "..", "..", "..");
const cachePath = path.join(__dirname, "..", "..", "cache");

const pLimit = require('p-limit');
const limit = pLimit(6);

const app = express();
const db = {
    //a list of all files
    allFiles : [],
    //a list of cache files folder -> files
    cacheTable: {},
    //hash to file or dir path
    hashTable: {},
    //hash to tag or author
    tagHashTable: {}
};

app.use(express.static('dist'));
app.use(express.static(root));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

const imageTypes = [".jpg", ".png"];
const compressTypes = [".zip", ".rar"];

function isImage(fn) {
    return imageTypes.some((e) => fn.endsWith(e));
}

function isCompress(fn) {
    return compressTypes.some((e) => fn.endsWith(e));
}

function getOutputPath(zipFn) {
    let outputFolder = path.basename(zipFn, path.extname(zipFn));
    outputFolder = outputFolder.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>/]/gi, '');
    return path.join(cachePath, outputFolder);
}

function generateContentUrl(pathes, outputPath) {
    const files = [];
    const dirs = [];
    const base = path.basename(outputPath);
    for (let i = 0; i < pathes.length; i++) {
        const p = pathes[i];
        if (isImage(p)) {
            let temp = path.join("cache", base, p);
            temp = temp.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
            files.push(temp);
        }
    }
    return { files, dirs };
}

//  outputPath is the folder name
function getCache(outputPath) {
    //in-memory is fast
    if(db.cacheTable[outputPath] && db.cacheTable[outputPath].length > 0){
        return generateContentUrl(db.cacheTable[outputPath], outputPath);
    }

    // this is slow
    // if (fs.existsSync(outputPath)) {
    //     const cacheFiles =  fs.readdirSync(outputPath);
    //     return generateContentUrl(cacheFiles, outputPath);
    // }
    return null;
}

async function init() {
    const {stdout, stderr} = await execa("chcp");
    console.log("[chcp]", stdout);
    const r = new RegExp("\\d+");
    const m = r.exec(stdout);
    const charset = parseInt(m && m[0]);

    if (charset !== 65001) {
        console.error("Please switch you console encoding to utf8 in windows language setting");
    }

    console.log("scanning local files");

    const filter = (e) => {return isCompress(e) || isImage(e);};
    let beg = (new Date).getTime()
    const results = fileiterator(userConfig.home_pathes, { filter }).concat(userConfig.home_pathes);
    let end = (new Date).getTime();
    console.log((end - beg)/1000, "to read local dirs");
    console.log("Analyzing local files");
    
    const arr = [];
    for (let i = 0; i < results.length; i++) {
        const p = results[i];
        const ext = path.extname(p).toLowerCase();
        if (!ext || isCompress(ext)) {
            arr.push(p);

            db.hashTable[stringHash(p)] = p;
            updateTagHash(p);
        }
    }
    db.allFiles = arr || [];

    setUpFileWatch();
    app.listen(8080, () => console.log('Listening on port 8080!'));
    console.log("init done");
}

function setUpFileWatch(){
    var watcher = chokidar.watch(userConfig.home_pathes, {
        ignored: /\*.jpg/,
        ignoreInitial: true,
        persistent: true
    });
    var log = console.log.bind(console);

    const addCallBack = path => {
        // log(`${path} has been added`);
        db.allFiles.push(path);

        updateTagHash(path);
        db.hashTable[stringHash(path)] = path;
    };

    const deleteCallBack = path => {
        // log(`${path} has been removed`);
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
    var cacheWatcher = chokidar.watch(cachePath, {
        persistent: true
    });

    cacheWatcher
        .on('unlinkDir', path => {
            db.cacheTable[path] = undefined;
        });

    cacheWatcher
        .on('add', p => {
            const fp =  path.dirname(p);
            db.cacheTable[fp] = db.cacheTable[fp] || [];
            db.cacheTable[fp].push(path.basename(p));
        })
        .on('unlink', p => {
            const fp =  path.dirname(p);
            db.cacheTable[fp] = db.cacheTable[fp] || [];
            const index = db.cacheTable[fp].indexOf(path.basename(p));
            db.cacheTable[fp].splice(index, 1);
        });
}

init();

app.post('/api/moveFile', (req, res) => {
    const src = req.body && req.body.src;
    const dest = req.body && req.body.dest;

    if(!src || !dest){
        res.sendStatus(404);
        return;
    }

    (async () =>{
        const {stdout, stderr} = await execa("move", [src, dest]);
        if(!stderr){
            console.log(stdout);
            res.sendStatus(200);
        }else{
            console.error(stderr);
            res.sendStatus(404);
        }
    })();
});

app.post('/api/lsDir', (req, res) => {
    const hashdir = db.hashTable[(req.body && req.body.hash)];
    const dir = hashdir|| req.body && req.body.dir;

    if (!dir || !fs.existsSync(dir)) {
        res.sendStatus(404);
        return;
    }

    fs.readdir(dir, (error, results) => {
        const files = [];
        const dirs = [];
        for (let i = 0; results && i < results.length; i++) {
            let p = results[i];
            const ext = path.extname(p).toLowerCase();
            if (!ext) {
                dirs.push(path.join(dir, p));
            } else if (isImage(ext) || isCompress(ext)) {
                files.push(path.join(dir, p));
            }

            updateTagHash(p);
            p = path.join(dir, p);
            db.hashTable[stringHash(p)] = p;
        }

        //sort by modified time
        files.sort(function(a, b) {
            return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
        })

        const result = {dirs, files, path: dir}
        res.send(result);
    });
});

function updateTagHash(str){
    const result = nameParser.parse(str);
    if(result){
        result.tags.forEach(tag => {
            db.tagHashTable[stringHash(tag)] = tag;
        });

        if(result.author){
            db.tagHashTable[stringHash(result.author)] = result.author;
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
        const result = nameParser.parse(e);
        if (result) {
            addOne(authors, result.author);
            result.tags.forEach(tag => addOne(tags, tag));
        }

        updateTagHash(e);
    });
    res.send({ tags, authors });
});

function searchByTagAndAuthor(tag, author, text, onlyNeedOne) {
    // let beg = (new Date).getTime()
    const files = [];
    for (let ii = 0; ii < db.allFiles.length; ii++) {
        const e = db.allFiles[ii];
        const result = (author || tag) && nameParser.parse(e);
        if (result && author &&  result.author === author) {
            files.push(e);
        }
        if (result && tag && result.tags.indexOf(tag) > -1) {
            files.push(e);
        }

        if (text && e.indexOf(text) > -1) {
            files.push(e);
        }

        if (onlyNeedOne && files.length > 1) {
            break;
        }
    }

    // let end = (new Date).getTime();
    // console.log((end - beg)/1000, "to search");
    return { files, tag, author };
}

// tree para
// 1. hash
// 2. mode
// 3. text
app.post("/api/search", (req, res) => {
    const mode = req.body && req.body.mode;
    const hashTag =  db.tagHashTable[(req.body && req.body.hash)];
    const tag =  mode === "tag" && hashTag;
    const author =  mode === "author" && hashTag;
    const text = mode === "search" && req.body && req.body.text;

    if (!author && !tag && !text) {
        res.sendStatus(404);
        return;
    }

    res.send(searchByTagAndAuthor(tag, author, text));
});

app.post("/api/tagFirstImagePath", (req, res) => {
    const author = req.body && req.body.author;
    const tag = req.body && req.body.tag;
    if (!author && !tag) {
        res.sendStatus(404);
        return;
    }

    const { files } = searchByTagAndAuthor(tag, author, null, true);
    const filePathes = files;
    const chosendFileName = filePathes.filter(isCompress)[0];  // need to improve
    getFirstImageFromZip(chosendFileName, res);
});

function read7zOutput(data) {
    const lines = data && data.split("\n");
    const BEG = 52; // by 7zip
    const files = [];
    for (let ii = 0; ii < lines.length; ii++) {
        let line = lines[ii];
        if (line && line.length > BEG) {
            line = line.slice(BEG, line.length - 1);
            if (isImage(line) || isCompress(line)) {
                files.push(line.trim());
            }
        }
    }
    return files;
}

async function getFirstImageFromZip(fileName, res, mode, counter) {
    const outputPath = getOutputPath(fileName);
    const temp = getCache(outputPath);
    const isPreG = mode === "pre-generate";
    if(isPreG){
        res.send = () => {};
        res.sendStatus = () => {};
    }

    if (temp && temp.files[0] && isImage(temp.files[0])) {
        res.send({ image: temp.files[0] });
        return;
    }

    var stats = fs.statSync(fileName);
    var fileSizeInBytes = stats["size"]
    //Convert the file size to megabytes (optional)
    var fileSizeInMegabytes = fileSizeInBytes / 1000000.0;

    try{
        //bigger than 30mb
        if(fileSizeInMegabytes > 40 || isPreG){
            // assume zip
            let {stdout, stderr} = await limit(() => execa(sevenZip, ['l', '-ba', fileName]));
            const text = stdout;
            if (!text) {
                console.error("[getFirstImageFromZip]", "no text");
                res.send("404 fail");
                return;
            }

            const files = read7zOutput(text);
            const one = files[0];

            if (!one) {
                console.error("[getFirstImageFromZip]", fileName,  "no files from output");
                res.sendStatus(404);
                return;
            }

            // Overwrite mode
            const opt = ['x', fileName, `-o${outputPath}`, one, "-aos"];
            const {stdout2, stderr2} = await execa(sevenZip, opt);
            if (!stderr2) {
                // send path to client
                let temp = path.join("cache", path.basename(outputPath), one);
                temp = temp.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
                res.send({ image: temp });

                if(isPreG){
                    counter.counter++;
                    console.log("pre-generate", counter.counter, "/", counter.total);
                }
            } else {
                console.error("[getFirstImageFromZip extract exec failed]", code);
                res.sendStatus(404);
            }
        } else {
            (async () => {
                const all = ['e', fileName, `-o${outputPath}`, "-aos"];
                const {stdout, stderr} = await execa(sevenZip, all);
                if (!stderr) {
                    fs.readdir(outputPath, (error, results) => {
                        const temp = generateContentUrl(results, outputPath);
                        res.send({ image: temp.files[0]});
                    });
                } else {
                    res.sendStatus(404);
                    console.error('[getFirstImageFromZip extract exec failed] exit: ', stderr);
                }
            })();
        }
    } catch(e) {
        console.error("[getFirstImageFromZip exception", e);
        res.sendStatus(404);
    }
}

//  a huge back ground tast 
//  it generate all thumbnail 
//  will need about 50 GB local space
// and will be slow
// http://localhost:8080/api/pregenerateThumbnails
app.get('/api/pregenerateThumbnails', (req, res) => {
    let counter = {counter: 1, total: db.allFiles.length};
    db.allFiles.forEach(fileName =>{
        getFirstImageFromZip(fileName, res, "pre-generate", counter);
    })
});


//! !need to set windows console to utf8
app.post('/api/firstImage', (req, res) => {
    const fileName = req.body && req.body.fileName;
    if (!fileName || !fs.existsSync(fileName)) {
        res.sendStatus(404);
        return;
    }
    getFirstImageFromZip(fileName, res);
});

// http://localhost:8080/api/extract
app.post('/api/extract', (req, res) => {
    const hashFile = db.hashTable[(req.body && req.body.hash)];
    const fileName = hashFile ||  req.body && req.body.fileName;
    if (!fileName || !fs.existsSync(fileName)) {
        res.sendStatus(404);
        return;
    }
    const outputPath = getOutputPath(fileName);
    const temp = getCache(outputPath);
    if (temp && temp.files.length > 10) {
        res.send({ files: temp.files, path: fileName });
        return;
    }

    (async () => {
        try{
            const all = ['e', fileName, `-o${outputPath}`, "-aos"];
            const {stdout, stderr} = await execa(sevenZip, all);
            if (!stderr) {
                fs.readdir(outputPath, (error, results) => {
                    const temp = generateContentUrl(results, outputPath);
                    res.send({ ...temp, path:fileName });
                });
            } else {
                res.sendStatus(404);
                console.error('[/api/extract] exit: ', stderr);
            }
        } catch (e){
            res.sendStatus(404);
            console.error('[/api/extract] exit: ', e);
        }
    })();
});


