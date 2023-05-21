

const path = require('path');
const pfs = require('promise-fs');
const serverUtil = require("./serverUtil");
const logger = require("./logger");

const isHiddenFile = function (f) {
    const temp = path.basename(f);
    return temp && temp[0] === ".";
}


module.exports = async function (fp, option) {
    try {
        let pathes = await pfs.readdir(fp, option);
        pathes = pathes.filter(e => {
            if (option && option.withFileTypes) {
                e = e.name;
            }
            return !isHiddenFile(e) && !serverUtil.isForbid(e);
        });
        return pathes;
    } catch (e) {
        logger.error(e);
        return [];
    }
}
