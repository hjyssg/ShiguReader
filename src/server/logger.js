const winston = require("winston");
const dateFormat = require('dateformat');
const path = require('path');
const pathUtil = require("./pathUtil");
const userConfig = require('../user-config');

const rootPath = pathUtil.getRootPath();
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd HH-MM"))+ ".log";

const _log = winston.createLogger({
    transports: [
      new winston.transports.File({ 
        filename: logPath, 
        formatter: function(params) {
            return params.message ? params.message : "";
        }})
    ]
});

module.exports.error = function(...args){
    _log.error(...args);
    console.error(...args);
}

module.exports.info = function(...args){
    _log.info(...args);
    console.log(...args);
}

