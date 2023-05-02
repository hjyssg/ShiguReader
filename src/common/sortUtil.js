const nameParser = require('../name-parser');
const _ = require('underscore');

//有三种时间
// mtime: OS磁盘文件系统保存
// rtime:最近一次的阅读时间
// tag time:根据文件名推算出来的时间
module.exports.sort_file_by_time = function (files, config) {
    const { fileInfos, getBaseName, ascend, onlyByMTime, byReadTime, byReadCount, fileNameToHistory } = config;
    const fp2Time = {};

    // 5400个文件计算time需要0.4秒
    let logLabel = "sort_file_by_time  "+files.length;
    console.time(logLabel);
    files.forEach(fp => {
        if(fp2Time[fp]){
            return fp2Time[fp];
        }

        const fn = getBaseName(fp);

        const mTime = fileInfos && fileInfos[fp] && parseInt(fileInfos[fp].mtimeMs);
        let tTime = nameParser.getDateFromParse(fn);
        tTime = tTime && tTime.getTime();

        let time = -Infinity;
        //单纯文件夹

        if(byReadCount){
            const count = fileNameToHistory && fileNameToHistory[fn] && parseInt(fileNameToHistory[fn].count);
            time = count || 0;
        }else if (byReadTime) {
            const rTime = fileNameToHistory && fileNameToHistory[fn] && parseInt(fileNameToHistory[fn].time);
            time = rTime || mTime || tTime;
        } else if (onlyByMTime) {
            time = mTime;
        } else {
            time = mTime || tTime;
        }

        time = time || -Infinity;
        fp2Time[fp] = ascend ? time : -time;
        return fp2Time[fp];
    })
    console.timeEnd(logLabel);

    logLabel = "sort_file_by_time  "+files.length + " part_2"
    console.time(logLabel);
    files.sort((a, b)=> fp2Time[a] - fp2Time[b]);
    console.timeEnd(logLabel);
}

