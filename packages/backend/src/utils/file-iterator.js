

const path = require('path');
const _ = require("underscore");
const pfs = require('promise-fs');
const pathUtil = require("./path-util");



module.exports = async function (folders, config) {
    if (_.isString(folders)) {
        folders = [folders]
    }

    const result = { pathes: [], infos: {} };
    config.visited = {};
    for (let ii = 0; ii < folders.length; ii++) {
        const src = folders[ii];
        if (await pathUtil.isExist(src)) {
            const stat = await pfs.stat(src);
            if (stat.isFile()) {
                throw "[file-iterator] only source folder path";
            } else {
                console.log("[file-iterator] begin:", src);
                await iterate(src, config, result, 0);
            }
        } else {
            console.error(`[file-iterator] ${src} does not exist! Please check you config-path.ini and user-config.js`);
            console.error(`[file-iterator] ${src} 不存在! 检查一下你的config-path.ini和user-config.js`);
        }
    }
    delete config.visited;
    return result;
};

function isLegalDepth(depth, config) {
    if (_.has(config, "depth")) {
        return depth <= config.depth;
    }
    return true;
}

async function get_stat(p) {
    const stat = await pfs.stat(p);
    const result = {};
    result.isDir = stat.isDirectory();
    result.mtimeMs = stat.mtimeMs;
    result.size = stat.size;
    return result;
}

async function iterate(p, config, result, depth, isFile) {
    if (config.visited[p]) {
        return;
    }
    try {
        if (isFile) {
            const currentLen = result.pathes.length;
            if (config && config.doLog && currentLen % 2000 === 0) {

                if (config.estimated_total) {
                    console.log("[file-iterator] scan:", currentLen, `  ${(currentLen / config.estimated_total * 100).toFixed(2)}%`);
                } else {
                    console.log("[file-iterator] scan:", currentLen);
                }
            }
            if (!config.doNotNeedInfo) {
                const stat = await get_stat(p, config);
                result.infos[p] = stat;
            }
            result.pathes.push(p);
        } else if (isLegalDepth(depth + 1, config)) {
            let pathes = await pathUtil.readdirOneLevel(p, { withFileTypes: true });
            //iterate all file
            pathes = _.sortBy(pathes, e => {
                if (e.isFile()) {
                    return 0;
                } else {
                    return 1;
                }
            });

            for (let ii = 0; ii < pathes.length; ii++) {
                const obj = pathes[ii];
                const e = obj.name;
                if (config.filter && !config.filter(e)) {
                    continue;
                }

                const fp = path.join(p, e);
                await iterate(fp, config, result, depth + 1, obj.isFile());
            }
        }
    } catch (e) {
        console.error("[file-iterator]", e);
    } finally {
        config.visited[p] = true;
    }
}
