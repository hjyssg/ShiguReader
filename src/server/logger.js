const winston = require("winston");
const dateFormat = require('dateformat');
const path = require('path');
const pathUtil = require("./pathUtil");

let logPath = path.join(pathUtil.getWorkSpacePath(), "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd HH-MM")) + ".log";
console.log("log path: ", logPath)

const _log = winston.createLogger({
    transports: [
        new winston.transports.File({
            filename: logPath,
            formatter: function (params) {
                return params.message ? params.message : "";
            }
        })
    ]
});

module.exports.error = function (...args) {
    _log.error(...args);
    console.error(...args);
}

module.exports.info = function (...args) {
    _log.info(...args);
    console.log(...args);
}

