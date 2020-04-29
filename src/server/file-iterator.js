

const path = require('path');
const fs = require("fs");
const _ = require("underscore");
const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
const userConfig = require('../user-config');

module.exports = function (folders, config) {
    const hasDb = !!config.db_path;
    const db = hasDb && new JsonDB(new Config(config.db_path, true, true, '/'));
    let infos;
    try{
        infos =  hasDb && db.getData("/");
    }catch (e){
        console.error("[file-iterator]",e)
    }
   
    const result = {pathes: [], infos: infos||{} };
    config.visited = {};
    folders.forEach((src) => {
        if(fs.existsSync(src)){
            const stat = fs.statSync(src);
            if (stat.isFile()) {
                throw "only source folder path";
            } else {
                iterate(src, config, result, 0);
            }
        }else{
            if(userConfig.home_pathes.includes(src)){
                console.error(`[file-iterator] ${src} does not exist! Please check you user-config.js home_pathes`);
                console.error(`[file-iterator] ${src} 不存在! 检查一下你user-config.js的home_pathes`);
            }
        }
    });
    delete config.visited;

    try{
        hasDb && db.push("/", result.infos);
    }catch (e){
        console.error("[file-iterator]",e)
    }
    return result;
};

function isLegalDepth(depth, config) {
    if (_.has(config, "depth")) {
        return depth <= config.depth;
    }
    return true;
}

function getStat(p, config){
    const stat = fs.statSync(p);
    //for jsonify
    stat.isFile = stat.isFile();
    stat.isDirectory = stat.isDirectory();
    // if(config.getExtraInfo){
    //     stat.extra = config.getExtraInfo(p, stat);
    // }
    return stat;
}

function iterate (p, config, result, depth) {
    if(config.visited[p]){
        return;
    }
    try {
        const stat = result.infos[p] || getStat(p, config);
        result.infos[p] = stat;
        if (stat.isFile) {
            if (config && config.filter && !config.filter(p)) {
                return;
            }

            if(config && config.doLog &&  result.pathes.length % 2000 === 0){
                console.log("[file-iterator] scan:", result.pathes.length);
            }
            result.pathes.push(p);
        } else if (stat.isDirectory && isLegalDepth(depth + 1, config)) {
            fs.readdirSync(p).forEach((e) => {
                e = path.join(p, e);
                iterate(e, config, result, depth + 1);
            });
        }
    } catch (e) {
        console.error("[file-iterator]",e);
    } finally{
        config.visited[p] = true;
    }
}
