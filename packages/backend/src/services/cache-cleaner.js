const fs = require('fs');
const path = require('path');
const rimraf = require("../utils/rimraf");

const pathUtil = require("../utils/path-util");
const logger = require("../config/logger");

let counter = 0;
function del(file, cachePath) {
    if (pathUtil.isSub(cachePath, file)) {
        rimraf(file, (err) => {
            if (err) {
                logger.error("[cache clean]", err);
            }
        });

        counter++;
        if (counter % 500 === 0) {
            logger.info("[cache clean] delete:", counter);
        }
    } else {
        throw "try to delete non-cache file";
    }
}

function cleanCache(cachePath, config) {
    config = config || {};
    counter = 0
    if (!fs.existsSync(cachePath)) {
        fs.mkdir(cachePath, (err) => {
            if (err instanceof Error) {
                throw err;
            }
        });
    } else {
        _clean(cachePath, config);
    }
}

function _clean(cachePath, config) {
    const folders1 = fs.readdirSync(cachePath);
    //check each file/dir in level 1
    folders1.forEach(fPath => {
        try {
            fPath = path.resolve(cachePath, fPath);
            del(fPath, cachePath);
        } catch (e) {
            logger.error("[cache clean] error", e);
        }
    });
    logger.info("[cache clean] done");
    config.afterClean && config.afterClean();
}

module.exports = cleanCache;
