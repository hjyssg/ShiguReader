const nameParser = require('../name-parser');
const _ = require('underscore');

//有三种时间
// mtime: OS磁盘文件系统保存
// rtime:最近一次的阅读时间
// tag time:根据文件名推算出来的时间
module.exports.sort_file_by_time = function (files, config) {
    const { fileInfos, getBaseName, ascend, onlyByMTime, byReadTime, fileNameToReadTime } = config;
    return _.sortBy(files, a => {
        const fn = getBaseName(a);

        const mTime = fileInfos && fileInfos[a] && parseInt(fileInfos[a].mtimeMs);
        let tTime = nameParser.getDateFromParse(fn);
        tTime = tTime && tTime.getTime();

        let time = -Infinity;
        //单纯文件夹
        if(byReadTime){
            const rTime = fileNameToReadTime &&  fileNameToReadTime[fn] && parseInt(fileNameToReadTime[fn]);
            time = rTime || mTime || tTime;
        }else if(onlyByMTime){
            time = mTime;
        }else{
            time = mTime || tTime;
        }

        time = time || -Infinity;
        return ascend ? time : -time;
    })
}

