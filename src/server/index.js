const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const allfl = require('./node-filelist');
const nameParser = require('./name-parser');
const userConfig = require('../user-config');
const sevenZip = require('7zip')['7z'];
const { spawn } = require('child-process-promise');

const pathes = userConfig.home_pathes;

//  https://www.npmjs.com/package/node-7z#options
const root = path.join(__dirname, "..", "..", "..");
const cachePath = path.join(__dirname, "..", "..", "cache");

// const cachePath = path.join("C:\\cache");

const app = express();
const db = {};

app.use(express.static('dist'));
app.use(express.static(root));

//  to consume json request body
//  https://stackoverflow.com/questions/10005939/how-do-i-consume-the-json-post-data-in-an-express-application
app.use(express.json());

const imageTypes = ["jpg", "png"];
const compressTypes = ["zip", "rar"];

function isImage(fn) {
    return imageTypes.some((e) => fn.endsWith(e));
}

function isCompress(fn) {
    return compressTypes.some((e) => fn.endsWith(e));
}

allfl.read(pathes, {}, (results) => {
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

    // todo
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

    // assume zip
    const getList = spawn(sevenZip, ['l', '-ba', fileName], { capture: ['stdout', 'stderr'] });

    getList.then((data) => {
        // parse 7zip output
        const text = data.stdout;
        if (!text) {
            res.send("404 fail");
        }

        const files = read7zOutput(text);

        if (!files[0]) {
            res.send(404);
        }

        const outputFolder = path.basename(fileName, path.extname(fileName));
        const outPath = path.join(cachePath, outputFolder);
        const one = files[0];
        // Overwrite mode
        const opt = ['x', fileName, `-o${outPath}`, one, "-aos"];
        const getFirst = spawn(sevenZip, opt, { capture: ['stdout', 'stderr'] });
        const childProcess = getFirst.childProcess;
        childProcess.on("close", (code) => {
            console.log('[spawn /api/firstImage] exit:', code);
            if (code === 0) {
                // send path to client
                let temp = path.join("cache", path.basename(outPath), one);
                temp = temp.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
                res.send({ image: temp });
            } else {
                console.error("[spawn /api/firstImage]", code);
                res.send(404);
            }
        });

        // console.log('[spawn] childProcess.pid: ', childProcess.pid);
        // childProcess.stdout.on('data', function (data) {
        // 	console.log('[spawn] stdout: ', data.toString());
        // });
        // childProcess.stderr.on('data', function (data) {
        // 	console.log('[spawn] stderr: ', data.toString());
        // });

        // getFirst.then('data', function (data) {
        // 	data = data.stdout;
        // 	console.log('extract: ' + data);
        // 	res.send(data);
        // }).catch(function (data) {
        // 	console.log('when extracting, received a error: ' + data);
        // 	res.send("7zip error");
        // });
    })
        .catch((data) => {
            console.log(`/api/firstImage received a error: ${data}`);
            res.send(404);
        });
});

// http://localhost:8080/api/extract
app.post('/api/extract', (req, res) => {
    const fileName = req.body && req.body.fileName;
    if (!fileName) {
        res.send(404);
    }

    const outputFolder = path.basename(fileName, path.extname(fileName));
    const outPath = path.join(cachePath, outputFolder);

    const all = ['e', fileName, `-o${outPath}`, "-aos"];

    const task = spawn(sevenZip, all, { capture: ['stdout', 'stderr'] });
    const childProcess = task.childProcess;
    childProcess.on("close", (code) => {
        console.log('[spawn /api/extract] exit: ', code);
        if (code === 0) {
            fs.readdir(outPath, (error, results) => {
                const files = [];
                const dirs = [];
                for (let i = 0; i < results.length; i++) {
                    const p = results[i];
                    if (isImage(p)) {
                        let temp = path.join("cache", path.basename(outPath), p);
                        temp = temp.replace(new RegExp(`\\${  path.sep}`, 'g'), '/');
                        files.push(temp);
                    }
                }
                res.send({ dirs, files });
            });
        } else {
            res.send(404);
        }
    });
});

app.listen(8080, () => console.log('Listening on port 8080!'));
