const nameParser = require('../name-parser');
const _ = require('underscore');


/**
 * sort file by time。
 * 有三种时间
 *  * mtime: OS磁盘文件系统保存
 *  * rtime:最近一次的阅读时间
 *  * tag time:根据文件名推算出来的时间
 */
module.exports.sort_file_by_time = function (files, config) {
    const { fileInfos, getBaseName, ascend, onlyByMTime } = config;
    const fp2Time = {};

    // 5400个文件计算time需要0.4秒
    let logLabel = "sort_file_by_time  "+files.length;
    // console.time(logLabel);

    files.forEach(fp => {
        if(fp2Time[fp]){
            return fp2Time[fp];
        }
        const fn = getBaseName(fp);
        let time = null;

        function getMtime(){
            if(!time){
                const mTime = fileInfos && fileInfos[fp] && parseInt(fileInfos[fp].mtimeMs);
                time = mTime;
            }
        }

        function getTTime(){
            if(!time){
                let tTime = nameParser.getDateFromParse(fn);
                tTime = tTime && tTime.getTime();
                time = tTime;
            }
        }
     
        if (onlyByMTime) {
            getMtime();
        } else {
            getMtime();
            getTTime();
        }

        time = time || -Infinity;
        fp2Time[fp] = ascend ? time : -time;
        return fp2Time[fp];
    })
    // console.timeEnd(logLabel);

    // logLabel = "sort_file_by_time  "+files.length + " part_2"
    // console.time(logLabel);
    files.sort((a, b)=> fp2Time[a] - fp2Time[b]);
    // console.timeEnd(logLabel);
}

