const util = global.requireUtil();
const path = require('path');
const stringHash = require("string-hash");
const nameParser = require('../name-parser');
const sortUtil = require("../common/sortUtil");
const { isImage, isCompress } = util;

const userConfig = global.requireUserConfig();

/*
*  cache folder name and thumbnail file name
*/
module.exports.getHash = function (filePath) {
    let hash;
    // potential bug:
    // files that have same name in the same folder, but different 
    // but the thumbnail can be shared between scan mode and unscanned mode
    // todo: can be fixed delete thumbnail when file change
    if (!userConfig.readable_cache_folder_name) {
        hash = stringHash(filePath).toString();
    } else {
        hash = path.basename(filePath, path.extname(filePath));
        hash = hash.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>/]/gi, '');
        hash += "_" + stringHash(filePath).toString()
    }
    hash = hash.trim();
    return hash;
}



const filterHiddenFile = module.exports.filterHiddenFile = function (files) {
    return files.filter(f => {
        const temp = path.basename(f);
        return temp && temp[0] !== ".";
    })
}

const isHiddenFile = module.exports.isHiddenFile = function (f) {
    const temp = path.basename(f);
    return temp && temp[0] === ".";
}

module.exports.chooseOneZipForOneTag = function (files, fileInfos) {
    let _files = files.filter(e => {
        if (e.includes("アニメ") || !isCompress(e) || isHiddenFile(e)) {
            return false;
        }
        return true;
    });

    const config = {
        fileInfos,
        getBaseName
    }

    _files = sortUtil.sort_file_by_time(_files, config);
    return _files[0];
}

function getBaseName(e) {
    return path.basename(e);
}

module.exports.getDirName = function (p) {
    const result = path.dirname(p);
    return path.basename(result);
}

const sortFileNames = module.exports.sortFileNames = function (files) {
    util._sortFileNames(files, e => path.basename(e, path.extname(e)));
}

module.exports.chooseThumbnailImage = function (files) {
    if (files.length === 0) {
        return null;
    }

    let tempFiles = files.filter(e => isImage(e) && !isHiddenFile(e));
    sortFileNames(tempFiles);
    return tempFiles[0];
}

module.exports.parse = function (str) {
    return nameParser.parse(path.basename(str, path.extname(str)));
}


module.exports.getExt = function (p) {
    const ext = path.extname(p).toLowerCase();
    if (ext === ".!ut") {
        return ext;
    }

    //xxx NO.003 xxx is not meaningful extension
    //extension string should be alphabet(may with digit), but not only digit
    if (ext && /^\.[a-zA-z0-9]*$/.test(ext) && !/^\.[0-9]*$/.test(ext)) {
        return ext;
    } else {
        return "";
    }
}


const pfs = require('promise-fs');
const pathUtil = require("./pathUtil");

module.exports.mkdir = async function (path, quiet) {
    if (path && !(await pathUtil.isExist(path))) {
        try {
            const err = await pfs.mkdir(path, { recursive: true });
            if (err instanceof Error) {
                throw err;
            }
        } catch (err) {
            if (!quiet) {
                throw err;
            }
        }
    }
}

const forbid = ["System Volume Information",
    "$Recycle.Bin",
    "Config.Msi",
    "$WinREAgent",
    "Windows",
    "msdownld.tmp",
    "node_modules"];
const junk = require('junk');
module.exports.isForbid = function (str) {
    str = str.toLocaleLowerCase();
    return junk.is(str) || forbid.some(e => {
        return path.basename(str) === e.toLocaleLowerCase();
    });
}


// https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function makeid() {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < 30; i++ ) {
      result += characters.charAt(Math.floor(Math.random() *  charactersLength));
   }
   return result;
}
module.exports.makeid = makeid;


const net = require('net');
function isPortOccupied(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
                  .once('error', err => {
                    if (err.code !== 'EADDRINUSE') {
                      reject(err);
                      return;
                    }
                    resolve(true);
                  })
                  .once('listening', () => {
                    server.close();
                    resolve(false);
                  })
                  .listen(port);
  });
}
module.exports.isPortOccupied = isPortOccupied;

module.exports.common = {};
