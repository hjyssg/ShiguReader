const winston = require("winston");

module.exports.init = function(logPath){
    module.exports.logger = winston.createLogger({
        transports: [
          new winston.transports.Console(),
          new winston.transports.File({ 
            filename: logPath, 
            formatter: function(params) {
                return params.message ? params.message : "";
            }})
        ]
      });
}

