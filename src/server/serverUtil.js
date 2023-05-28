const util = global.requireUtil();
const path = require('path');
const stringHash = require("string-hash");
const nameParser = require('../name-parser');
const sortUtil = require("../common/sortUtil");
const { isImage, isCompress } = util;
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

function getBaseName(e) {
    return path.basename(e);
}

/** 从zip片中挑一个当代表 */
module.exports.chooseOneZipForOneTag = function (files, fileInfos) {
    let _files = files.filter(e => {
        if (e.includes("アニメ") || !isCompress(e) || pathUtil.isHiddenFile(e)) {
            return false;
        }
        return true;
    });

    const config = {
        fileInfos,
        getBaseName
    }

    sortUtil.sort_file_by_time(_files, config);
    return _files[0];
}

const sortFileNames = module.exports.sortFileNames = function (files) {
    util._sortFileNames(files, e => path.basename(e, path.extname(e)));
}

/** 从图片中挑一张封面 */
module.exports.chooseThumbnailImage = function (files) {
    if (files.length === 0) {
        return null;
    }

    let tempFiles = files.filter(e => isImage(e) && !pathUtil.isHiddenFile(e));
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

module.exports.isPortOccupied = isPortOccupied = (port) => {
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
      fn(req, res, next).catch((reason)=>{
        // next
        try{
            logger.error("asyncWrapper", reason, "\n\n", req);
            res.send({faled: true, reason: reason?.stack});
        }catch(e){
            debugger;
        }
      });
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



/** 计算对特定作者/tag的喜欢程度的分值 */
const getScoreFromCount = module.exports.getScoreFromCount = (countObj, goodDump) => {
    let { good_count=0, bad_count=0, total_count=0 } =  countObj;
    console.assert(good_count >= 0 && bad_count >= 0);
    console.assert(total_count >= 0 && total_count >= (good_count + bad_count));
    goodDump = goodDump || 100;

    // 写一个数学函数，当x逼近正无穷，y逼近1。要使保证x从0到100的范围内，y尽量均匀分布。超过100开始逼近1
    // 超过的部分， 超过的部分极小的加权
    // y区间约是0到2
    function f1(x, ceil) {
        ceil = ceil || goodDump; // fault value

        const a = Math.log((ceil+1)/ceil);
        if (x <= ceil) {
            return 1 - Math.exp(-a * x);
        } else {
            //阻尼过强，会导致一直垃圾小tag因为比例排前
            //太弱，又没啥效果。
            const above = (x - ceil);
            return 1 + f1(above, ceil + 5000);
        }
    }

    function f2(x){
        // 用Math.floor进行离散区间处理
        // +1 避免无穷
        return Math.floor(x/3) *3 + 1;
    }

    let result = 0;
    if(good_count == 0 && bad_count == 0){
        // 啥都没有，纯中性
        result = 0;
    }else if(good_count == 0 && bad_count > 0){
        // 区间是负数
        // 虽然bad，但数量多的话，给分高点。 
        // 虽然不喜欢，到时下载得多。还是有点好感的概念
        result = -1/f2(total_count);
    }else {
        const g = good_count;
        const b = f2(bad_count);
        // 既看比例，
        const ratio = g / (g + b);
        // 也看绝对值
        const absV1 = f1(g);
        const absV2 = f1(total_count - g - b);
        // 最终区间落在0~4
        result = ratio +  absV1 + absV2;
    }

    return Number(result.toFixed(3));
}   



// 测试 getScoreFromCount()
// for(let ii = 0; ii < 100; ii++){
//     const temp =  getScoreFromCount({
//         bad_count: 2,
//         good_count: ii
//     });

//     console.log(ii, "   ", temp);
// }