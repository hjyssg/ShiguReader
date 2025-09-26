const winston = require("winston");
const dateFormat = require('dateformat');
const path = require('path');


let _log;
module.exports.init = function(){
    const pathUtil = require("../utils/pathUtil");
    let logPath = path.join(pathUtil.getWorkSpacePath(), "log");
    logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd HH-MM")) + ".log";
    console.log("log File path: ", logPath)

    // singleton
    _log = winston.createLogger({
        level: "debug",
        transports: [
            new winston.transports.File({
                filename: logPath,
                formatter: function (params) {
                    return params.message ? params.message : "";
                }
            })
        ]
    });
}




/**
* log error 始终显示
*/
module.exports.error = function (...args) {
    _log && _log.error(...args);
    console.trace("----");
    console.error(...args);
}


/**
* log warn 始终显示
*/
module.exports.warn = function (...args) {
    _log && _log.warn(...args);
    console.warn(...args);
}

/**
* log info 发布版不用给用户看太多信息
*/
module.exports.info = function (...args) {
    _log && _log.info(...args);
    if(!global.isPkg){  //发布版不用给用户看太多信息
        console.log(...args);
    }
}

/**
* log debug 发布版不用给用户看太多信息
*/
module.exports.debug = function(...args) {
    _log && _log.debug(...args);
    if(!global.isPkg){  //发布版不用给用户看太多信息
        console.debug(...args);
    }
}
