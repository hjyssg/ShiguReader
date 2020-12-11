const fs = require('fs');
const path = require('path');
const rimraf = require("./rimraf");

let counter = 0;
const pathUtil = require("../server/pathUtil");
const { isSub } = pathUtil;

const show_error = false;

function del(file, cachePath) {
    if (isSub(cachePath, file)) {
        rimraf(file, (err) => {
            if (err) {
                show_error && console.error("[cache clean]", err);
            }
        });

        counter++;
        if (counter % 500 === 0) {
            console.log("[cache clean] delete:", counter);
        }
    } else {
        throw "try to delete non-cache file";
    }
}

function cleanCache(cachePath, config) {
    config = config || {};
    counter = 0
    if (!fs.existsSync(cachePath)) {
        err = fs.mkdir(cachePath, (err) => {
            if (err) {
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
            show_error && console.error("[cache clean] error", e);
        }
    });
    console.log("[cache clean] done");
    config.afterClean && config.afterClean();
}

module.exports.cleanCache = cleanCache;