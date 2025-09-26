const _ = require('underscore');
const nameParser = require('../name-parser');
const path = require('path');
const util = global.requireUtil();

const clearObject = (obj) => {
    Object.keys(obj).forEach(key => delete obj[key]);
};

const setToMidnight = (timestamp) => {
    if(!timestamp){
        return null;
    }
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0); // 将小时、分钟、秒和毫秒设置为 0
    return date.getTime();
};

const modifyDataForChart = (data) => {
    const filtererFiles = _.keys(data.fileInfos);

    
    filtererFiles.forEach((e) => {
        data.fileInfos[e]= data.fileInfos[e] || {};
        data.fileInfos[e].fileName = path.basename(e, path.extname(e));
    })

    // timestamp -> {fileSize, fileCount}
    // 初始化 byMTime 和 ByTagTime
    const byMTime = {};
    const ByTagTime = {};
    filtererFiles.forEach((e) => {
        const fileInfo = data.fileInfos[e] || {};
        const fileName = fileInfo.fileName;

        // 文件大小
        const fileSize = fileInfo.size || 0;
        let mTime = setToMidnight(fileInfo.mtimeMs);

        let tagTime = nameParser.getDateFromParse(fileName);
        tagTime = setToMidnight(tagTime) || mTime;

        // 判断文件类型
        let type = null;
        if (util.isVideo(e)) {
            type = "video";
        } else if (util.isCompress(e)) {
            type = "compress";
        }

        // 初始化日期项
        byMTime[mTime] = byMTime[mTime] || {};
        ByTagTime[tagTime] = ByTagTime[tagTime] || {};

        byMTime[mTime][type] = byMTime[mTime][type] || { fileSize: 0, fileCount: 0 };
        ByTagTime[tagTime][type] = ByTagTime[tagTime][type] || { fileSize: 0, fileCount: 0 };


        // 根据文件类型统计
        byMTime[mTime][type].fileSize += fileSize;
        byMTime[mTime][type].fileCount += 1;

        ByTagTime[tagTime][type].fileSize += fileSize;
        ByTagTime[tagTime][type].fileCount += 1;
    });

    // comiket: number
    const byComiket = _.countBy(filtererFiles, (e) => {
        const fileInfo = data.fileInfos[e];
        const fileName = fileInfo.fileName;
        const result = nameParser.parse(fileName);
        if (result && result.comiket) {
            let cc = result.comiket;
            return cc.toUpperCase();
        } else {
            return "etc";
        }
    });

    // type: number
    const byType = _.countBy(filtererFiles, (e) => {
        const fileInfo = data.fileInfos[e];
        const fileName = fileInfo.fileName;
        const result = nameParser.parse(fileName);
        if (result) {
          return result.type;
        } else {
          return "UNKOWN";
        }
    });

    clearObject(data);

    data.byComiket = byComiket;
    data.byType = byType;

    data.ByTagTime = ByTagTime;
    data.byMTime = byMTime;
    return data;
};


// 自定义中间件，用于修改响应数据
const modifyResponseForChart = (req, res, next) => {
    const originalSend = res.send;

    res.send = function (data) {
        if (req.body.forChart) {
            data = modifyDataForChart(data)
            return originalSend.call(this, data);
        } else {
            // 如果请求体中不包含 for chart，则直接发送原始数据
            return originalSend.call(this, data);
        }
    };

    next();
};

module.exports = modifyResponseForChart;
