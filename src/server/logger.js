const winston = require("winston");
const dateFormat = require('dateformat');
const path = require('path');
const pathUtil = require("./pathUtil");
const userConfig = require('../user-config');

const rootPath = pathUtil.getRootPath();
let logPath = path.join(rootPath, userConfig.workspace_name, "log");
logPath = path.join(logPath, dateFormat(new Date(), "yyyy-mm-dd HH-MM"))+ ".log";

module.exports = winston.createLogger({
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ 
        filename: logPath, 
        formatter: function(params) {
            return params.message ? params.message : "";
        }})
    ]
});

