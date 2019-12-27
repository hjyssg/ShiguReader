

const path = require('path');
const fs = require("fs");
const _ = require("underscore");
const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;

const db = new JsonDB(new Config("shigureader_local_file_info", true, true, '/'));
let dbInfo = db.getData("/");

module.exports = function (folders, config) {
    const result = {pathes: [], infos: {} };
    config.visited = {};
    folders.forEach((src) => {
        const stat = fs.statSync(src);
        if (stat.isFile()) {
            throw "only source folder path";
        } else {
            iterate(src, config, result, 0);
        }
    });
    delete config.visited;

    db.push("/", dbInfo);
    return result;
};

function isLegalDepth(depth, config) {
    if (_.has(config, "depth")) {
        return depth <= config.depth;
    }
    return true;
}

function getStat(p){
    let stat;
    stat = dbInfo[p];
    if(!stat){
        stat = fs.statSync(p);
        stat.isFile = stat.isFile();
        stat.isDirectory = stat.isDirectory();
        dbInfo[p] = stat;
    }
    return stat;
}

function iterate (p, config, result, depth) {
    if(config.visited[p]){
        return;
    }
    let stat = getStat(p);
    
    result.infos[p] = stat;
    try {
        if (stat.isFile) {
            if (config && config.filter && !config.filter(p)) {
                return;
            }

            if(config && config.doLog && result.pathes.length % 100 === 0){
                console.log("scan:", result.pathes.length);
            }
            result.pathes.push(p);
        } else if (stat.isDirectory && isLegalDepth(depth + 1, config)) {
            fs.readdirSync(p).forEach((e) => {
                e = path.join(p, e);
                iterate(e, config, result, depth + 1);
            });
        }
    } catch (e) {
        console.error(e);
    } finally{
        config.visited[p] = true;
    }
}
