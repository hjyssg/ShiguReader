

const path = require('path');
const _ = require("underscore");
const pfs = require('promise-fs');

module.exports = async function (folders, config) {
    const result = {pathes: [], infos: {}};
    config.visited = {};
    for(let ii = 0; ii < folders.length; ii++){
        const src = folders[ii];
        if(await pfs.existsSync(src)){
            const stat = await pfs.statSync(src);
            if (stat.isFile()) {
                throw "[file-iterator] only source folder path";
            } else {
                await iterate(src, config, result, 0);
            }
        }else{
            console.error(`[file-iterator] ${src} does not exist! Please check you path-config and user-config.js`);
            console.error(`[file-iterator] ${src} 不存在! 检查一下你的path-config和user-config.js`);
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

async function getStat(p){
    const stat = await pfs.statSync(p);
    const result = {};
    result.isFile = stat.isFile();
    result.isDir = stat.isDirectory();
    result.mtimeMs = stat.mtimeMs;
    result.mtime = stat.mtime;
    result.size = stat.size;
    return result;
}

async function iterate (p, config, result, depth, isFile) {
    if(config.visited[p]){
        return;
    }
    try {
        if(isFile){
            if(config && config.doLog &&  result.pathes.length % 500 === 0){
                console.log("[file-iterator] scan:", result.pathes.length);
            }
            if(!config.doNotNeedInfo){
                const stat =  await getStat(p, config);
                result.infos[p] = stat;
            }
            result.pathes.push(p);
        } else if (isLegalDepth(depth + 1, config)) {
            let pathes = await pfs.readdir(p, {withFileTypes: true });
            //iterate all file
            pathes = _.sortBy(pathes, e => {
                if(e.isFile()){
                    return 0;
                }else{
                    return 1;
                }
            });

            for(let ii = 0; ii < pathes.length; ii++){
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
        console.error("[file-iterator]",e);
    } finally{
        config.visited[p] = true;
    }
}
