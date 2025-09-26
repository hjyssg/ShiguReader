const path = require('path');
const execa = require('../utils/ownExeca');
const pfs = require('promise-fs');
const _ = require('underscore');
const zipInfoDb = require("../models/zipInfoDb");
const logger = require("../config/logger");
const util = require('../common/util');
const pathUtil = require("../utils/pathUtil");
// const { isImage, isCompress, isMusic, isVideo, getCurrentTime, isDisplayableInExplorer, isDisplayableInOnebook } = util;
const { isExist } = pathUtil;
// const iconv = require('iconv-lite');

global._has_7zip_ = true;
let sevenZip;

module.exports.init = function(){
    if (global.isWindows) {
        try{
            const sevenZipPath = path.join(pathUtil.getRootPath(), "resource", "7zip");
            sevenZip = require(sevenZipPath)['7z'];
        }catch{
            global._has_7zip_ = false;
            logger.error("[ERROR] no 7zip on windows");
        }
        // console.log("sevenZipPath", sevenZipPath);
    } else {
        //assume linux/mac people already install it by cmd
        //https://superuser.com/questions/548349/how-can-i-install-7zip-so-i-can-run-it-from-terminal-on-os-x
        sevenZip = "7z";
        execa(sevenZip)
            .then(() => { })
            .catch(e => {
                global._has_7zip_ = false;
                logger.error("[warning] this computer did not install 7z")
                logger.error("[warning] mac and *nix people need to install 7zip themselves")
                logger.error("On Debian and Ubuntu install the p7zip-full package.\nOn Mac OSX use Homebrew brew install p7zip")
            });
    }
}


module.exports.sevenZip = sevenZip;


function read7zOutput(data) {
    const files = [];
    const fileInfos = [];
    if(!data){
        return { files, fileInfos };
    }

    let lines = data.split("\n");
    lines = lines.map(e => e.trim()).filter(e => e.length > 0);
    let currentInfo;
    try {
        for (let ii = 0; ii < lines.length; ii++) {
            let line = lines[ii];
            //https://stackoverflow.com/questions/20474257/split-string-into-two-parts
            const sep = " = ";
            var index = line.indexOf(sep);  // Gets the first index where a space occours
            const key = line.substr(0, index); // Gets the first part
            const value = line.substr(index + sep.length).trim();  // Gets the text part

            // an example 
            // Path = 041.jpg
            // Folder = -
            // Size = 1917111
            // Packed Size = 1865172
            // Modified = 2020-04-03 17:29:52
            // Created = 2020-04-03 17:29:52
            // Accessed = 2020-04-03 17:29:52
            if (key && value) {
                const lkey = key.toLowerCase();
                if (lkey === "path") {
                    if (currentInfo) {
                        fileInfos.push(currentInfo);
                    }
                    files.push(value);
                    currentInfo = {};
                } else {
                    currentInfo[lkey] = value;
                }
            }else{
                // debugger
            }
        }

        //save the last
        if (currentInfo) {
            fileInfos.push(currentInfo);
        }
        if (fileInfos.length !== files.length) {
            throw "[read7zOutput] read7zOutput missing info";
        }
        return { files, fileInfos };
    } catch (e) {
        logger.error('[read7zOutput] exit: ', e);
    }
}

const getExtractOption = module.exports.getExtractOption = function (filePath, outputPath, file_specifier, levelFlag) {
    //https://sevenzip.osdn.jp/chm/cmdline/commands/extract.htm
    //e make folder as one level
    //x different level
    levelFlag = levelFlag || "x";
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

        return [levelFlag, filePath, `-o${outputPath}`].concat(specifier, "-aos", "-r");
    } else {
        return [levelFlag, filePath, `-o${outputPath}`, "-aos"];
    }
}

const LIST_QUEUE = {};
module.exports.listZipContentAndUpdateDb = async function (filePath) {
    const emptyResult = { files: [], fileInfos: [], info: {} };
    if (!global._has_7zip_) {
        throw "this computer did not install 7z"
    }

    try {
        if (!(await isExist(filePath))) {
            return emptyResult;
        }

        let text;
        let _stderr;

        // zip内部文件夹有奇怪字符  🍑  🍊 ・ 会输出不对
        let { stdout, stderr } = await execa(sevenZip, ['l', '-r', '-ba', '-slt', filePath]);

        text = stdout;
        _stderr = stderr;

        if (!text || _stderr || LIST_QUEUE[filePath]) {
            return emptyResult;
        }

        LIST_QUEUE[filePath] = true;

        const { files, fileInfos } = read7zOutput(text);

        let totalImgSize = 0;
        let totalSize = 0;
        let mtime_arr = [];
        files.forEach((e, ii) => {
            const singleSize = parseFloat(fileInfos[ii].size) || 0;
            if (util.isImage(e)) {
                totalImgSize += singleSize;
            }

            // 这个是解压后的大小，不是实际大小
            totalSize += singleSize;

            // https://stackoverflow.com/questions/1353684/detecting-an-invalid-date-date-instance-in-javascript
            var timestamp = Date.parse(fileInfos[ii].modified);
            if (isNaN(timestamp) == false) {
                mtime_arr.push(timestamp);
            }
        })
        const mtime = util.getAverage(mtime_arr);

        const info = {
            filePath,
            totalImgSize,
            files,
            mtime,
            totalSize
        };

        zipInfoDb.updateZipDb(info);
        return { files, fileInfos, info };
    } catch (e) {
        logger.error("[listZipContentAndUpdateDb]", filePath, e);
        return emptyResult;
    } finally {
        LIST_QUEUE[filePath] = null;
    }
}

module.exports.extractByRange = async function (filePath, outputPath, range) {
    if (!global._has_7zip_) {
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
            let opt = getExtractOption(filePath, outputPath, subRange, "x");
            let { stderr, stdout } = await execa(sevenZip, opt);
            if (stderr) {
                error = stderr;
                // logger.error('[extractByRange] exit: ', stderr);
                break;
            }
            if(stdout.includes("No files to process")){
                // 常见原因是zip内部文件夹有奇怪字符  🍑  🍊 ・
                // debugger
                throw "NEED_TO_EXTRACT_ALL";
            }
            ii = ii + DISTANCE;
            count++;
            console.assert(count < 100);
        }
    } catch (e) {
        error = e;
        logger.error('[extractByRange] exit: ', e);
    } finally {
        return error;
    }
}

module.exports.extractByExtension = async function(filePath, outputPath, extensions) {
    if (!global._has_7zip_) {
        throw "this computer did not install 7z";
    }

    let error, pathes = [];
    try {
        const opt = getExtractOption(filePath, outputPath, extensions, "x");
        const { stderr, stdout } = await execa(sevenZip, opt);
        if (stderr) {
            throw stderr;
        }
        pathes = (await (pathUtil.readDirForFileAndFolder(outputPath, true))).pathes;
    } catch (e) {
        error = e;
        logger.error('[extractByExtension] exit: ', e);
    } finally {
            return { error, pathes };
    }
}



// isRecursive 参数已经保留兼容性，但现在始终保持原来的文件夹结构
module.exports.extractAll = async function (filePath, outputPath, isRecursive) {
    if (!global._has_7zip_) {
        throw "this computer did not install 7z"
    }

    const opt = getExtractOption(filePath, outputPath, null, "x");
    let error, pathes = [];
    try {
        const { stderr } = await execa(sevenZip, opt);
        if (stderr) {
            throw stderr;
        }

        pathes = (await pathUtil.readDirForFileAndFolder(outputPath, true)).pathes;
    } catch (e) {
        error = e;
        logger.error('[extractAll] exit: ', e);
    } finally {
        return { error, pathes };
    }
}

module.exports.zipOneFolder = async function (folderPath, resultZipPath) {
    resultZipPath = resultZipPath || `${folderPath}.zip`;
    const { stdout, stderr } = await execa(sevenZip, ["a", resultZipPath, `${folderPath}${path.sep}*`]);
    return { stdout, stderr, resultZipPath };
}
