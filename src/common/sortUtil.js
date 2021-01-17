const nameParser = require('../name-parser');
const _ = require('underscore');

//有三种时间
// mtime: OS磁盘文件系统保存
// rtime:最近一次的阅读时间
// tag time:根据文件名推算出来的时间
module.exports.sort_file_by_time = function (files, config) {
    const { fileInfos, getBaseName, fromEarly, onlyMtime, fileNameToReadTime } = config;
    return _.sortBy(files, a => {
        const fn = getBaseName(a);
        let fileTimeA;

        //todo: only be mtime, or mtime + rtime



        if(fileNameToReadTime[fn]){
            fileTimeA = parseInt(fileNameToReadTime[fn]);
        }else{
            fileTimeA = (fileInfos[a] && fileInfos[a].mtimeMs) || -Infinity;
        }
        // console.log(fn, fileTimeA)
        if (onlyMtime) {
            return fromEarly ? fileTimeA : -fileTimeA;
        } else {
            let aboutTimeA = nameParser.getDateFromParse(fn);
            aboutTimeA = aboutTimeA && aboutTimeA.getTime();
            const t1 = aboutTimeA || fileTimeA;
            return fromEarly ? t1 : -t1;
        }
    })
}

