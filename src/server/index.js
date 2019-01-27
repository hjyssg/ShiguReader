const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const fileiterator = require('../file-iterator');
const nameParser = require('../name-parser');
const userConfig = require('../user-config');
const sevenZip = require('7zip')['7z'];
const { spawn, exec } = require('child-process-promise');
const ora = require('ora');
const stringHash =require("string-hash");
var chokidar = require('chokidar');

const root = path.join(__dirname, "..", "..", "..");
const cachePath = path.join(__dirname, "..", "..", "cache");

const app = express();
const db = {
    //a list of all files
    allFiles : [],
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

function getCache(outputPath) {
    if (fs.existsSync(outputPath)) {
        const cacheFiles =  fs.readdirSync(outputPath);
        return generateContentUrl(cacheFiles, outputPath);
    }
    return null;
}

function init() {
    const chcpTast = exec("chcp", { capture: ['stdout', 'stderr'] });
    
    const spinner = ora();
    spinner.text = "scanning local files";
    spinner.color = "yellow";
    spinner.start();

    chcpTast.then(data => {
        console.log("[chcp]", data.stdout);
        const r = new RegExp("\\d+");
        const m = r.exec(data.stdout);
        const charset = parseInt(m && m[0]);

        if (charset !== 65001) {
            console.error("Please switch you console encoding to utf8 in windows language setting");
        }
    });

    spinner.succeed();
    spinner.text = "Analyzing local files";
    spinner.color = "green";
    spinner.start();

    const filter = (e) => {return isCompress(e) || isImage(e);};
    let beg = (new Date).getTime()
    const results = fileiterator(userConfig.home_pathes, { filter }).concat(userConfig.home_pathes);
    let end = (new Date).getTime();
    console.log((end - beg)/1000, "to read local dirs");
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
    spinner.succeed();
}

function setUpFileWatch(){
    var watcher = chokidar.watch(userConfig.home_pathes, {
        ignored: /\*.jpg/,
        ignoreInitial: true,
        persistent: true}
    );
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
    .on('unlinkDir', deleteCallBack)

}

init();

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

function searchByTagAndAuthor (tag, author, text) {
    const files = [];
    db.allFiles.forEach((e) => {
        const result = (author ||tag) && nameParser.parse(e);
        if (result && author &&  result.author === author) {
            files.push(e);
        }
        if (result && tag && result.tags.indexOf(tag) > -1) {
            files.push(e);
        }

        if(text && e.indexOf(text) > -1){
            files.push(e);
        }
    });

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

    const { files } = searchByTagAndAuthor(tag, author);
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

function getFirstImageFromZip(fileName, res) {
    const outputPath = getOutputPath(fileName);
    const temp = getCache(outputPath);
    if (temp && temp.files[0] && isImage(temp.files[0])) {
        res.send({ image: temp.files[0] });
        return;
    }

    // assume zip
    const getList = spawn(sevenZip, ['l', '-ba', fileName], { capture: ['stdout', 'stderr'] });
    getList.then((data) => {
        // parse 7zip output
        const text = data.stdout;
        if (!text) {
            console.error("[getFirstImageFromZip]", "no text");
            res.send("404 fail");
            return;
        }

        const files = read7zOutput(text);

        if (!files[0]) {
            console.error("[getFirstImageFromZip]", "no files");
            res.sendStatus(404);
            return;
        }

        const one = files[0];
        // Overwrite mode
        const opt = ['x', fileName, `-o${outputPath}`, one, "-aos"];
        const getFirst = spawn(sevenZip, opt, { capture: ['stdout', 'stderr'] });
        const childProcess = getFirst.childProcess;

        childProcess.on("close", (code) => {
            // console.log('[spawn /api/firstImage] exit:', code);
            if (code === 0) {
                // send path to client
                let temp = path.join("cache", path.basename(outputPath), one);
                temp = temp.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
                res.send({ image: temp });
            } else {
                console.error("[getFirstImageFromZip extract spawn failed]", code);
                res.sendStatus(404);
            }
        });
    })
    .catch((data) => {
        console.error(`[getFirstImageFromZip list content] received a error: ${data}`);
        res.sendStatus(404);
    });
}

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

    const all = ['e', fileName, `-o${outputPath}`, "-aos"];
    const task = spawn(sevenZip, all, { capture: ['stdout', 'stderr'] });
    const childProcess = task.childProcess;
    childProcess.on("close", (code) => {
        // console.log('[spawn /api/extract] exit: ', code);
        if (code === 0) {
            fs.readdir(outputPath, (error, results) => {
                const temp = generateContentUrl(results, outputPath);
                res.send({ ...temp, path:fileName });
            });
        } else {
            res.sendStatus(404);
            console.error('[spawn /api/extract] exit: ', code);
        }
    });
});

app.listen(8080, () => console.log('Listening on port 8080!'));
