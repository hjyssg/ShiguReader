const fs = require('fs');
const path = require('path');
const execa = require('execa');
const pfs = require('promise-fs');
const _ = require('underscore');
const isWindows = require('is-windows');
const zipInfoDb = require("./models/zipInfoDb");
const { updateZipDb } = zipInfoDb;
const logger = require("./logger");
const util = global.requireUtil();
const pathUtil = require("./pathUtil");
const { isImage, isCompress, isMusic, isVideo, arraySlice, getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;
const { isExist } = pathUtil;

global._has_7zip_ = true;
let sevenZip;
if (isWindows()) {
    const sevenZipPath = path.join(pathUtil.getRootPath(), "resource", "7zip");
    sevenZip = require(sevenZipPath)['7z'];
    console.log("sevenZipPath", sevenZipPath);
} else {
    //assume linux/mac people already install it by cmd
    //https://superuser.com/questions/548349/how-can-i-install-7zip-so-i-can-run-it-from-terminal-on-os-x
    sevenZip = "7z";
    execa(sevenZip)
        .then(() => { })
        .catch(e => {
            global._has_7zip_ = false;
            console.warn("[warning] this computer did not install 7z")
            console.warn("[warning] mac and *nix people need to install 7zip themselves")
            console.warn("On Debian and Ubuntu install the p7zip-full package.\nOn Mac OSX use Homebrew brew install p7zip")
        });
}

module.exports.sevenZip = sevenZip;


function read7zOutput(data) {
    const lines = data && data.split("\n");
    const files = [];
    const fileInfos = [];
    let currentInfo;
    try {
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
            if (tokens.length === 2) {
                const key = tokens[0];
                const value = tokens[1].trim();
                const lkey = key.toLowerCase();
                if (lkey === "path") {
                    currentInfo && fileInfos.push(currentInfo);
                    files.push(value);
                    currentInfo = {};
                } else {
                    currentInfo[lkey] = value;
                }
            }
        }

        //save the last
        currentInfo && fileInfos.push(currentInfo);
        if (fileInfos.length !== files.length) {
            throw "read7zOutput missing info";
        }
        return { files, fileInfos };
    } catch (e) {
        // console.error("[read7zOutput]", e)
        logger.error('[read7zOutput] exit: ', e);
    }
}

const get7zipOption = module.exports.get7zipOption = function (filePath, outputPath, file_specifier) {
    //https://sevenzip.osdn.jp/chm/cmdline/commands/extract.htm
    //e make folder as one level
    if (file_specifier) {
        let specifier = _.isArray(file_specifier) ? file_specifier : [file_specifier];
        specifier = specifier.map(e => {
            //-0018.jpg will break 7zip
            if (e.startsWith("-")) {
                return "*" + e.slice(1);
            } else {
                return e;
            }
        })

        return ['e', filePath, `-o${outputPath}`].concat(specifier, "-aos");
    } else {
        return ['e', filePath, `-o${outputPath}`, "-aos"];
    }
}

const LIST_QUEUE = {};
module.exports.listZipContentAndUpdateDb = async function (filePath) {
    const emptyResult = { files: [], fileInfos: [], info: {} };
    if(!global._has_7zip_){
        throw "this computer did not install 7z"
    }

    try {
        if (!(await isExist(filePath))) {
            return emptyResult;
        }

        //https://superuser.com/questions/1020232/list-zip-files-contents-using-7zip-command-line-with-non-verbose-machine-friend
        let { stdout, stderr } = await execa(sevenZip, ['l', '-r', '-ba', '-slt', filePath]);
        const text = stdout;
        if (!text || stderr || LIST_QUEUE[filePath]) {
            return emptyResult;
        }

        LIST_QUEUE[filePath] = true;

        const { files, fileInfos } = read7zOutput(text);
        const musicFiles = files.filter(isMusic);

        let totalImgNum = 0;
        let totalImgSize = 0;
        files.forEach((e, ii) => {
            if (isImage(e)) {
                totalImgNum++;
                totalImgSize += parseFloat(fileInfos[ii].size) || 0;
            }
        })

        const info = {
            pageNum: totalImgNum,
            totalImgSize,
            avgImgSize: totalImgSize / totalImgNum,
            musicNum: musicFiles.length
        };

        updateZipDb(filePath, info);
        return { files, fileInfos, info };
    } catch (e) {
        logger.error("[listZipContentAndUpdateDb]", filePath, e);
        return emptyResult;
    } finally {
        LIST_QUEUE[filePath] = null;
    }
}

module.exports.extractByRange = async function (filePath, outputPath, range) {
    if(!global._has_7zip_){
        throw "this computer did not install 7z"
    }

    let error;
    try {
        //quitely unzip second part
        const DISTANCE = 200;
        let ii = 0;

        let count = 0;

        while (ii < range.length) {
            //cut into parts
            //when range is too large, will cause OS level error
            let subRange = range.slice(ii, ii + DISTANCE);
            let opt = get7zipOption(filePath, outputPath, subRange);
            let { stderr } = await execa(sevenZip, opt);
            if (stderr) {
                error = stderr;
                logger.error('[extractByRange] exit: ', stderr);
                break;
            }
            ii = ii + DISTANCE;

            count++;

            if (count > 100) {
                console.log("-----------warning-----------");
                debugger
            }
        }
    } catch (e) {
        error = e;
        logger.error('[extractByRange] exit: ', e);
    } finally {
        return error;
    }
}
module.exports.extractAll = async function (filePath, outputPath) {
    if(!global._has_7zip_){
        throw "this computer did not install 7z"
    }

    const opt = get7zipOption(filePath, outputPath);
    let error, pathes
    try {
        const { stderr } = await execa(sevenZip, opt);
        if (stderr) {
            throw stderr;
        } 
        pathes = await pfs.readdir(outputPath);
    } catch (e) {
        error = e;
        logger.error('[extractAll] exit: ', e);
    } finally {
        return { error, pathes }
    }
}

module.exports.zipOneFolder = async function (folderPath, resultZipPath) {
    resultZipPath = resultZipPath || `${folderPath}.zip`;
    const { stdout, stderr } = await execa(sevenZip, ["a", resultZipPath, `${folderPath}${path.sep}*`]);
    return { stdout, stderr, resultZipPath };
}