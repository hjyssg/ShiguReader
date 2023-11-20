const util = global.requireUtil();
const path = require('path');
const stringHash = require("string-hash");
const nameParser = require('../name-parser');
// const sortUtil = require("../common/sortUtil");
// const { isImage, isCompress } = util;
const fs = require('fs');
const logger = require("./logger");
const pfs = require('promise-fs');
const pathUtil = require("./pathUtil");
const userConfig = global.requireUserConfig();
const net = require('net');

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

// function getBaseName(e) {
//     return path.basename(e);
// }

/** 从zip片中挑一个当代表 */
// module.exports.chooseOneZipForOneTag = function (files, fileInfos) {
//     let _files = files.filter(e => {
//         if (e.includes("アニメ") || !isCompress(e) || pathUtil.isHiddenFile(e)) {
//             return false;
//         }
//         return true;
//     });

//     const config = {
//         fileInfos,
//         getBaseName
//     }

//     sortUtil.sort_file_by_time(_files, config);
//     return _files[0];
// }

const sortFileNames = module.exports.sortFileNames = function (files) {
    util._sortFileNames(files, e => path.basename(e, path.extname(e)));
}

/** 从图片中挑一张封面 */
module.exports.chooseThumbnailImage = function (files) {
    if (files.length === 0) {
        return null;
    }

    let tempFiles = files.filter(e => util.isImage(e) && !pathUtil.isHiddenFile(e));
    sortFileNames(tempFiles);
    return tempFiles[0];
}

/** 解析filepath */
module.exports.parse = function (str) {
    return nameParser.parse(path.basename(str, path.extname(str)));
}

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

const mkdirSync = module.exports.mkdirSync = (path, quiet) => {
    if (path && !fs.existsSync(path)) {
        try {
            fs.mkdirSync(path, { recursive: true });
        } catch (err) {
            if (!quiet) {
                throw err;
            }
        }
    }
}

module.exports.mkdirList = (mkdirArr) => {
    for (let ii = 0; ii < mkdirArr.length; ii++) {
        const fp = mkdirArr[ii];
        if (!global.isWindows && util.isWindowsPath(fp)) {
            continue;
        }
        mkdirSync(fp, "quiet");
    }
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

module.exports.isPortOccupied = (port) => {
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

/**
 * Async wrapper function。用来封装所有的async request
 */
module.exports.asyncWrapper = (fn) => {
    return (req, res, next) => {
      const beginTime = util.getCurrentTime();
      fn(req, res, next)
      .then(()=>{
        // 测量性能
        const timeSpent = util.getCurrentTime() - beginTime;
        const url = req.url || "";
        const exclude_list  = ["/api/download", "/api/getQuickThumbnail", "/api/findSimilarFile/"];
        let shouldLog = true;
        exclude_list.forEach(e => {
            if(url.includes(e)){
                shouldLog = false;
            }
        })

        let warnFlg = timeSpent > 300;
        if(shouldLog || warnFlg){
            logger.debug(`[${decodeURI(url)}] ${timeSpent}ms`);
        }
      })
      .catch((reason)=>{
        // next
        try{
            logger.error("asyncWrapper", reason, "\n\n", req);
            res.send({faled: true, reason: reason?.stack});
        }catch(e){
            debugger;
        }
      })
    };
};

// write a nodejs function that suspend the progtam until user type something
const readline = require('readline');
module.exports.suspend = ()  => {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('---------------------', (answer) => {
      rl.close();
      resolve();
    });
  });
}

/** 用来避免循环引用的函数object */
module.exports.common = {};


// array变为map
module.exports.convertFileRowsIntoFileInfo = (rows) => {
    let fileInfos = {};
    rows.forEach(row => {
        const fp = row.filePath;

        console.assert(!!fp);
        console.assert("size" in row);
        console.assert("mTime" in row);

        fileInfos[fp] = {
            size: row.size,
            mtimeMs: row.mTime
        };
    })

    return fileInfos;
}


module.exports.joinThumbnailFolderPath = (thumbnailFileName) => {
    if(!thumbnailFileName){
        return "";
    }
    const thumbnailFolderPath = global.thumbnailFolderPath;
    return  thumbnailFolderPath + path.sep + thumbnailFileName;
}