const util = require('../common/util');
const path = require('path');
const stringHash = require("string-hash");
const nameParser = require('../name-parser');
// const sortUtil = require("../common/sortUtil");
// const { isImage, isCompress } = util;
const fs = require('fs');
const logger = require("../config/logger");
const pfs = require('promise-fs');
const pathUtil = require("./path-util");
const userConfig = require('../config/user-config');
const net = require('net');
const appState = require('../state/appState');

/*
*  cache folder name and thumbnail file name
*/
const getHash = function (filePath) {
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



const sortFileNames = function (files) {
    // 复用前端的排序逻辑，既比较目录也比较文件名，保证服务端返回顺序一致
    util._sortFileNames(
        files,
        e => path.basename(e, path.extname(e)),
        e => {
            const dir = path.dirname(e);
            return dir === '.' ? '' : dir;
        }
    );
}

/** 从图片中挑一张封面 */
const chooseThumbnailImage = function (files) {
    if (files.length === 0) {
        return null;
    }

    let tempFiles = files.filter(e => util.isImage(e) && !pathUtil.isHiddenFile(e));
    sortFileNames(tempFiles);
    return tempFiles[0];
}

/** 解析filepath */
const parse = function (str) {
    return nameParser.parse(path.basename(str, path.extname(str)));
}

const mkdir = async function (path, quiet) {
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

const mkdirSync = (path, quiet) => {
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

const mkdirList = (mkdirArr) => {
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


const isPortOccupied = (port) => {
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
const asyncWrapper = (fn) => {
    return (req, res, next) => {
      const beginTime = util.getCurrentTime();
      fn(req, res, next)
      .then(()=>{
        // 测量性能
        const timeSpent = util.getCurrentTime() - beginTime;
        const url = req.url || "";
        
        let shouldLog = false;
        const want_list  = [];
        want_list.forEach(e => {
            if(url.includes(e)){
                shouldLog = true;
            }
        })

        let warnFlg = timeSpent > 3000;
        if(shouldLog || warnFlg){
            const now = new Date();
            // 获取小时、分钟、秒
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            logger.debug(`[${decodeURI(url)}] ${hours}:${minutes}:${seconds} ${timeSpent}ms`);
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
const suspend = ()  => {
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




// array变为map
const convertFileRowsIntoFileInfo = (rows) => {
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


const joinThumbnailFolderPath = (thumbnailFileName) => {
    if(!thumbnailFileName){
        return "";
    }
    return path.join(appState.getThumbnailFolderPath(), thumbnailFileName);
}

/**
 * 写一个js函数，根据一个key list，只保留object需要的property
 */
function filterObjectProperties(obj, keysToKeep, needWarn) {
    // 遍历对象的所有属性
    return Object.keys(obj).reduce((acc, key) => {
      // 如果当前属性存在于 keysToKeep 数组中，将其添加到新对象中
      if (keysToKeep.includes(key)) {
        acc[key] = obj[key];
      }else if(needWarn){
        console.warn("filterObjectProperties", key);
      }
      return acc;
    }, {});
}

/** 开发用。检查的obj是不是都有这些key */
function checkKeys(obj, keys) {
    const objKeys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      if (!objKeys.includes(keys[i])) {
        console.warn("[checkKeys]", keys[i]);
      }
    }
}

/** 检查回传给onebook的res */
function checkOneBookRes(resObj){
    const allowedKeys = ["zipInfo", "path", "stat", "imageFiles", "musicFiles", "videoFiles", "dirs", "outputPath"];
    checkKeys(resObj, allowedKeys);
    resObj = filterObjectProperties(resObj, allowedKeys, false);
    return resObj;
}

// 隐私
function shrinkFp(fp){
    return fp.slice(0, 12) + "..." + fp.slice(fp.length - 10);
}

module.exports = {
    getHash,
    sortFileNames,
    chooseThumbnailImage,
    parse,
    mkdir,
    mkdirSync,
    mkdirList,
    makeid,
    isPortOccupied,
    asyncWrapper,
    suspend,
    convertFileRowsIntoFileInfo,
    filterObjectProperties,
    joinThumbnailFolderPath,
    checkKeys,
    checkOneBookRes
}