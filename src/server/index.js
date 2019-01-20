const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const allfl = require('./node-filelist');
const nameParser = require('./name-parser');
const userConfig = require('../user-config');
const sevenZip = require('7zip')['7z'];
const { spawn, exec } = require('child-process-promise');
const iconvLite = require('iconv-lite');

const root = path.join(__dirname, "..", "..", "..");
const cachePath = path.join(__dirname, "..", "..", "cache");

const app = express();
const db = {};

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

const chcpTast = exec("chcp", { capture: ['stdout', 'stderr'] });
chcpTast.then(data => {
    console.log("[chcp]", data.stdout);
    const r = new RegExp("\\d+");
    const m = r.exec(data.stdout);
    const charset = parseInt(m && m[0]);

    if (charset !== 65001) {
        console.error("Please switch you console encoding to utf8 in windows language setting");
    }
});

allfl.read(userConfig.home_pathes, {}, (results) => {
    const arr = [];
    for (let i = 0; i < results.length; i++) {
        const p = results[i].path;
        const ext = path.extname(p).toLowerCase();
        if (!ext || isCompress(ext)) {
            arr.push(p);
        }
    }
    db.allFiles = arr || [];
});

app.post('/api/lsDir', (req, res) => {
    const dir = req.body && req.body.dir;
    if (!dir) {
        res.send(404);
    }

    fs.readdir(dir, (error, results) => {
        const files = [];
        const dirs = [];
        for (let i = 0; results && i < results.length; i++) {
            const p = results[i];
            const ext = path.extname(p).toLowerCase();
            if (!ext) {
                dirs.push(path.join(dir, p));
            } else if (isImage(ext) || isCompress(ext)) {
                files.push(path.join(dir, p));
            }
        }
        res.send({ dirs, files });
    });
});

function addOne(table, key) {
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
            addOne(authors, result.author.name);
            addOne(tags, result.tag);
            (result.extra || []).forEach(tag => addOne(tags, tag));
        }
    });
    res.send({ tags, authors });
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

//! !need to set windows console to utf8
app.post('/api/firstImage', (req, res) => {
    const fileName = req.body && req.body.fileName;
    if (!fileName) {
        res.send(404);
    }

    const outputPath = getOutputPath(fileName);
    const temp = getCache(outputPath);
    if (temp && temp.files.length > 10) {
        res.send({ image: temp.files[0] });
        return;
    }

    // assume zip
    const getList = spawn(sevenZip, ['l', '-ba', fileName], { capture: ['stdout', 'stderr'] });
    getList.then((data) => {
        // parse 7zip output
        const text = data.stdout;
        if (!text) {
            console.error("/api/firstImage]", "no text");
            res.send("404 fail");
        }

        const files = read7zOutput(text);

        if (!files[0]) {
            console.error("/api/firstImage]", "no files");
            res.send(404);
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
                console.error("[spawn /api/firstImage]", code);
                res.send(404);
            }
        });
    })
    .catch((data) => {
        console.error(`[/api/firstImage] received a error: ${data}`);
        res.send(404);
    });
});

// http://localhost:8080/api/extract
app.post('/api/extract', (req, res) => {
    const fileName = req.body && req.body.fileName;
    if (!fileName) {
        res.send(404);
    }
    const outputPath = getOutputPath(fileName);
    const temp = getCache(outputPath);
    if (temp && temp.files.length > 10) {
        res.send({ files: temp.files });
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
                res.send({ ...temp });
            });
        } else {
            res.send(404);
            console.error('[spawn /api/extract] exit: ', code);
        }
    });
});

app.listen(8080, () => console.log('Listening on port 8080!'));
